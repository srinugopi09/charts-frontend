# rally — a CLI for Rally (Agile Central), friendly to humans and AI agents

`rally` is a small, fast, read-only Go CLI for the [Rally Web Services API v2.0](https://rally1.rallydev.com/slm/doc/webservice/).
One binary serves two audiences:

- **Humans** get pretty tables, simple filters, tab completion, and errors that tell you the fix.
- **AI agents** get compact cleaned JSON, stable exit codes, structured errors, runtime schema discovery, and zero interactive prompts — automatically, whenever stdout is not a terminal.

```
$ rally defects -f 'State != Closed' -f 'Severity = Critical'
FORMATTEDID  NAME                        STATE  SEVERITY  PRIORITY   OWNER     ITERATION
DE45         Login fails on Safari       Open   Critical  High       Jane Doe  Sprint 12
DE61         Checkout 500s on empty cart Open   Critical  Immediate  Raj Patel Sprint 12
Showing 2 of 2 results
```

## Install

```sh
# from this directory
make build            # → bin/rally
make install          # → $GOBIN/rally

# or directly
go install github.com/srinugopi09/rally-cli/cmd/rally@latest
```

Requires Go 1.23+ to build. No runtime dependencies.

## Quickstart

```sh
rally config set api_key <your-rally-api-key>   # create one at Rally → Settings → API Keys
rally whoami                                    # verify auth
rally stories                                   # your 20 most recent user stories
rally defects --iteration "Sprint 12"
rally get US123                                 # any artifact by FormattedID
rally schema defect                             # what fields exist (incl. custom c_*)
```

## Commands

| Command | What it does |
|---|---|
| `rally query <type>` | Query any WSAPI type (canonical form; works for all ~60 types) |
| `rally stories` `defects` `tasks` `testcases` `features` `epics` `iterations` `releases` `milestones` `users` | Aliases for `query` with the type pre-filled |
| `rally get <id>` | One object by FormattedID (`US123`) or `type/ObjectID` (`defect/4321987654`) |
| `rally get <id> --collection Tasks` | Follow a collection field and list its members |
| `rally schema [type]` | List all types, or one type's fields from live metadata |
| `rally whoami` | Show the authenticated user (setup check) |
| `rally config get\|set\|unset\|list\|path` | Manage `~/.config/rally/config.json` |
| `rally completion <shell>` | bash/zsh/fish/powershell completions |
| `rally version` | Version info (`-o json` for machine-readable) |

Every command supports `--help` with copy-pasteable examples.

### Filtering

Two ways, mutually exclusive:

```sh
# Simple: repeatable -f/--filter, AND-joined. Operators: = != > < >= <= contains !contains
rally defects -f 'State != Closed' -f 'Severity = Critical' -f 'Name contains login'

# Full Rally query language via -q/--query (needed for OR / nested logic)
rally query defect -q '((State = "Open") OR (State = "Submitted"))'
```

`-v` prints the compiled query so you can learn the raw syntax from the simple one.

### Pagination

- `-n/--limit 20` is the default; auto-paginates to reach the limit.
- `--all` fetches everything (guarded by `--max-requests`, default 100 requests).
- `--count` prints just the total as a bare integer.
- In JSON output, `total` vs `count` tells you whether the limit truncated.

### Scoping

`--workspace`/`--project` take an ObjectID or ref (`12345` or `/workspace/12345`) — set defaults with `rally config set workspace 12345`. `--scope-up`/`--scope-down` control project-tree scoping. FormattedIDs are workspace-scoped.

## Configuration & auth

Precedence: **flag > environment > config file > default**.

| Config key | Env var | Flag |
|---|---|---|
| `api_key` | `RALLY_API_KEY` | `--api-key` (discouraged: shell history) |
| `base_url` | `RALLY_BASE_URL` | `--base-url` (for on-prem Rally) |
| `workspace` | `RALLY_WORKSPACE` | `--workspace` |
| `project` | `RALLY_PROJECT` | `--project` |

Basic-auth fallback: `RALLY_USERNAME`/`RALLY_PASSWORD` are used only when no API key is set anywhere. The config file is created with `0600` permissions; `rally config list` masks the key.

## For AI agents

Everything an agent needs is in `rally --help`; this section is the same contract in long form.

**Invocation.** Output is JSON automatically when stdout is not a TTY (i.e., always, for a subprocess). No flags needed; `-o json` forces it. There are no interactive prompts, ever. stdout carries only data; all diagnostics go to stderr.

**Query envelope** (all query-shaped commands):

```json
{"results":[{"FormattedID":"DE45","Name":"Login fails","State":"Open","Owner":"Jane Doe","Iteration":"Sprint 12"}],"count":1,"total":42}
```

- `results` are **cleaned** Rally objects: API metadata (`_ref`, `_type`, `_rallyAPI*`, UUIDs) stripped, nested object refs collapsed to display names, collections collapsed to `{"count":N}`. Only fetched fields appear (default: the type's standard columns; control with `--fetch F1,F2` or `--fetch true`).
- `total > count` ⇒ the result was truncated by `--limit`; raise `-n` or use `--all`.
- `rally get` prints the bare cleaned object, no envelope.
- Escape hatches: `--refs` keeps `_ref` handles; `--raw` emits Rally's verbatim objects.
- **Follow-ups need no refs**: `FormattedID` is the universal handle — `rally get DE45`, `rally get DE45 --collection Discussion`.

**Errors.** Non-zero exit code plus exactly one JSON line on stderr:

```json
{"error":{"code":"auth_failed","exitCode":3,"message":"Rally rejected the request: ... Set a key with: rally config set api_key <key>, or export RALLY_API_KEY.","httpStatus":401}}
```

Stable `code` values: `usage`, `auth_failed`, `not_found`, `ambiguous_id`, `rally_error`, `bad_query`, `network`, `timeout`, `internal`.

**Exit codes** (stable contract):

| Code | Meaning |
|---|---|
| 0 | success — an empty result set is success |
| 1 | unexpected/internal error |
| 2 | usage error (bad flags, bad filter syntax) |
| 3 | authentication failed / no credentials |
| 4 | not found, or ambiguous FormattedID |
| 5 | Rally API error (e.g. bad query, reported in `Errors[]`) |
| 6 | network failure / timeout (after 3 retries with backoff) |

**Field discovery.** Never guess field names: `rally schema` lists all types; `rally schema <type>` lists that type's fields — including custom `c_*` fields — with type/required/read-only/constrained flags; add `--values` for the allowed values of constrained fields.

**Token economy.** Pick the cheapest sufficient output:

| Need | Invocation | Approx. cost |
|---|---|---|
| existence / how many | `--count` | one integer |
| bulk rows | `-o csv` (header once, no repeated JSON keys) | ~25 tokens/row |
| structured rows | default JSON | ~40 tokens/row |
| exact fields | `--fetch FormattedID,Name` | scales with fields |
| full fidelity | `--raw` | the raw Rally payload |

**Determinism.** Every query has a default sort (`FormattedID ASC`, or `ObjectID ASC` for types without one), so paging and repeat runs are stable. Auth comes from `RALLY_API_KEY`.

**A worked multi-step example:**

```sh
rally schema defect -o json                      # 1. discover fields
rally query defect -f 'State != Closed' --count  # 2. how many? (one integer)
rally query defect -f 'State != Closed' --fetch FormattedID,Name,Severity -n 200 -o csv   # 3. bulk pull
rally get DE45 --fetch true                      # 4. drill into one
rally get DE45 --collection Discussion           # 5. read its discussion
```

## Development

```sh
make build        # build bin/rally with version info
make test         # unit tests (httptest-mocked Rally; no network)
make lint         # gofmt + go vet
make integration  # live tests; requires RALLY_API_KEY, never in CI
```

Layout: `cmd/rally` (main), `internal/rally` (WSAPI client — importable as a library, no CLI deps), `internal/query` (filter → query-language compiler), `internal/output` (table/json/csv renderers), `internal/config`, `internal/cli` (cobra tree).

This directory is a self-contained Go module with no references to the surrounding repository — extracting it is copy + `go.mod` module rename.

### Design notes

- The client's `Do(ctx, method, path, params, body)` already carries method and body: write support (create/update/delete) is additive. Retry policy must gate on idempotent methods when that lands.
- Rally reports many errors inside HTTP 200 bodies (`Errors[]`); the client always checks and converts them to typed errors.
- Retries: 3 attempts on 429/5xx/transport errors, exponential backoff with jitter, honors `Retry-After`.

### Roadmap (explicitly not in v1)

Write operations · Lookback API (historical snapshots) · NDJSON streaming for very large exports · MCP server mode.
