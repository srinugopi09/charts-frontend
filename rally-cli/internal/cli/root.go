// Package cli is the presentation layer: the cobra command tree, flag
// handling, output-format selection, and exit-code mapping. All Rally access
// goes through internal/rally; all rendering through internal/output.
package cli

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/config"
	"github.com/srinugopi09/rally-cli/internal/output"
	"github.com/srinugopi09/rally-cli/internal/rally"
)

const rootLong = `rally — a fast, scriptable CLI for Rally (Agile Central) WSAPI v2.0. Read-only.

USAGE BY HUMANS
  Pretty tables on a terminal, helpful errors, tab completion (rally completion --help).

USAGE BY AI AGENTS (the contract)
  * Output is JSON automatically when stdout is not a TTY; force with -o json.
    Query commands emit {"results":[...],"count":N,"total":N} — results are
    cleaned objects (Rally metadata stripped, refs collapsed to display names,
    collections to {"count":N}). total > count means the query was truncated
    by --limit. Add --refs for _ref handles, --raw for verbatim Rally objects.
  * rally get <FormattedID> is the follow-up handle — you never need _ref URLs.
  * Errors: exit code + one JSON line on stderr:
      {"error":{"code":"...","exitCode":N,"message":"...","httpStatus":N}}
    Exit codes: 0 ok (empty result is ok) · 1 internal · 2 usage · 3 auth ·
    4 not found/ambiguous · 5 Rally API error · 6 network/timeout.
  * There are no interactive prompts, ever. stdout carries only data;
    diagnostics go to stderr.
  * Discover fields at runtime with: rally schema <type> (includes custom c_* fields).
  * Cheapest sufficient output: --count (one integer) < -o csv (bulk rows)
    < -o json (default fields) < --fetch F1,F2 (exact fields) < --raw.

AUTH & CONFIG
  Precedence: flag > env > config file (~/.config/rally/config.json) > default.
  Env: RALLY_API_KEY, RALLY_BASE_URL, RALLY_WORKSPACE, RALLY_PROJECT
       (RALLY_USERNAME/RALLY_PASSWORD basic-auth fallback when no API key).
  Start with: rally config set api_key <key> && rally whoami`

const rootExamples = `  rally whoami                                    # verify auth
  rally stories                                   # 20 most recent user stories
  rally defects -f 'State != Closed' -f 'Severity = Critical'
  rally stories --iteration "Sprint 12" -o csv
  rally query hierarchicalrequirement -q '((ScheduleState < Accepted) AND (Iteration.Name = "Sprint 12"))' --all
  rally get US123                                 # any artifact by FormattedID
  rally get US123 --collection Tasks              # a story's tasks
  rally query defect --count                      # just the number
  rally schema defect                             # field discovery (incl. custom fields)
  rally query defect -n 500 --fetch FormattedID,Name,State -o json`

// app carries resolved global options and streams; commands hang off it so
// tests can run the tree in-process with injected streams.
type app struct {
	// persistent flag values
	outputFlag  string
	jsonFlag    bool
	baseURL     string
	apiKey      string
	workspace   string
	project     string
	timeout     time.Duration
	noInput     bool
	verbose     bool
	pretty      bool
	refs        bool
	raw         bool
	maxRequests int

	cfg     config.Config
	format  output.Format
	version string
	commit  string

	stdout io.Writer
	stderr io.Writer
}

// Execute runs the CLI and returns the process exit code.
func Execute(version, commit string) int {
	a := &app{version: version, commit: commit, stdout: os.Stdout, stderr: os.Stderr}
	root := a.rootCmd()
	if err := root.Execute(); err != nil {
		ee := classify(err)
		a.printError(ee)
		return ee.Code
	}
	return ExitOK
}

func (a *app) rootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "rally",
		Short:         "Query Rally (Agile Central) from the command line — friendly to humans and AI agents",
		Long:          rootLong,
		Example:       rootExamples,
		Version:       a.version,
		SilenceErrors: true,
		SilenceUsage:  true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			return a.resolve(cmd)
		},
	}
	pf := root.PersistentFlags()
	pf.StringVarP(&a.outputFlag, "output", "o", "", "output format: table, json, csv (default: table on a TTY, json when piped)")
	pf.BoolVar(&a.jsonFlag, "json", false, "shorthand for -o json")
	_ = pf.MarkHidden("json")
	pf.StringVar(&a.baseURL, "base-url", "", "Rally WSAPI base URL (default "+rally.DefaultBaseURL+")")
	pf.StringVar(&a.apiKey, "api-key", "", "Rally API key (prefer RALLY_API_KEY or rally config set api_key — flags leak into shell history)")
	pf.StringVar(&a.workspace, "workspace", "", "workspace ObjectID or ref (e.g. 12345 or /workspace/12345)")
	pf.StringVar(&a.project, "project", "", "project ObjectID or ref (e.g. 67890 or /project/67890)")
	pf.DurationVar(&a.timeout, "timeout", 30*time.Second, "per-request timeout")
	pf.BoolVar(&a.noInput, "no-input", false, "never prompt (rally never prompts anyway; contractual no-op)")
	pf.BoolVarP(&a.verbose, "verbose", "v", false, "log requests and compiled queries to stderr (secrets redacted)")
	pf.BoolVar(&a.pretty, "pretty", false, "indent JSON output (auto on a TTY)")
	pf.BoolVar(&a.refs, "refs", false, "keep _ref handles in JSON output")
	pf.BoolVar(&a.raw, "raw", false, "emit Rally's objects verbatim in JSON output (no cleaning)")
	pf.IntVar(&a.maxRequests, "max-requests", rally.DefaultMaxRequests, "safety cap on WSAPI requests per command (--all pagination)")

	root.SetFlagErrorFunc(func(cmd *cobra.Command, err error) error {
		return usageError(err.Error() + ". Run '" + cmd.CommandPath() + " --help' for usage.")
	})
	root.SetOut(a.stdout)
	root.SetErr(a.stderr)

	root.AddCommand(
		a.queryCmd(),
		a.getCmd(),
		a.schemaCmd(),
		a.whoamiCmd(),
		a.configCmd(),
		a.versionCmd(),
	)
	root.AddCommand(a.aliasCmds()...)
	return root
}

// resolve loads config, applies flag > env > file precedence, and picks the
// output format. Runs before every command.
func (a *app) resolve(cmd *cobra.Command) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if a.apiKey != "" {
		cfg.APIKey = a.apiKey
		cfg.Sources["api_key"] = "flag --api-key"
	}
	if a.baseURL != "" {
		cfg.BaseURL = a.baseURL
	}
	if a.workspace != "" {
		cfg.Workspace = a.workspace
	}
	if a.project != "" {
		cfg.Project = a.project
	}
	a.cfg = cfg

	if a.outputFlag == "" && a.jsonFlag {
		a.outputFlag = "json"
	}
	format, err := output.Detect(a.outputFlag)
	if err != nil {
		return usageError(err.Error())
	}
	a.format = format
	if format == output.FormatJSON && a.outputFlag != "" && output.StdoutIsTTY() && !cmd.Flags().Changed("pretty") {
		a.pretty = true
	}
	return nil
}

// client builds the Rally client from resolved config.
func (a *app) client() (*rally.Client, error) {
	c, err := rally.New(a.cfg.BaseURL, a.cfg.APIKey, a.cfg.Username, a.cfg.Password, a.timeout)
	if err != nil {
		return nil, usageError(err.Error())
	}
	if a.cfg.APIKey == "" && a.cfg.Username == "" {
		return nil, &ExitError{Code: ExitAuth, ErrCode: "auth_failed",
			Message: "no Rally credentials found. Set a key with: rally config set api_key <key>, or export RALLY_API_KEY."}
	}
	if a.verbose {
		c.Logf = func(format string, args ...any) {
			fmt.Fprintf(a.stderr, "rally: "+format+"\n", args...)
		}
	}
	return c, nil
}

// renderOpts assembles output options for the current invocation.
func (a *app) renderOpts(columns []string) output.Options {
	return output.Options{
		Format:   a.format,
		Columns:  columns,
		Pretty:   a.pretty,
		KeepRefs: a.refs,
		Raw:      a.raw,
	}
}

var digitsRe = regexp.MustCompile(`^\d+$`)

// normalizeScopeRef turns "12345" into "/workspace/12345"; refs and URLs pass
// through. WSAPI scoping params take refs, not names.
func normalizeScopeRef(kind, v string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", nil
	}
	if strings.HasPrefix(v, "/") || strings.HasPrefix(v, "http") {
		return v, nil
	}
	if digitsRe.MatchString(v) {
		return "/" + kind + "/" + v, nil
	}
	return "", usageError(fmt.Sprintf("--%s must be an ObjectID or ref like /%s/12345 (WSAPI does not accept %s names); find the ID with: rally query %s --fetch Name,ObjectID", kind, kind, kind, kind))
}

// printError writes the error to stderr: structured JSON in JSON mode,
// friendly prose otherwise.
func (a *app) printError(ee *ExitError) {
	format := a.format
	if format == "" {
		format, _ = output.Detect(a.outputFlag)
	}
	if format == output.FormatJSON {
		output.WriteErrorJSON(a.stderr, output.ErrorJSON{
			Code:       ee.ErrCode,
			ExitCode:   ee.Code,
			Message:    ee.Message,
			Details:    ee.Details,
			HTTPStatus: ee.HTTPStatus,
		})
		return
	}
	fmt.Fprintf(a.stderr, "rally: %s\n", ee.Message)
	for _, d := range ee.Details {
		if d != ee.Message && d != "" {
			fmt.Fprintf(a.stderr, "  %s\n", d)
		}
	}
}

// warn prints Rally warnings (deduplicated) to stderr; they never fail a command.
func (a *app) warn(warnings []string) {
	seen := map[string]bool{}
	for _, w := range warnings {
		if w != "" && !seen[w] {
			seen[w] = true
			fmt.Fprintf(a.stderr, "rally: warning: %s\n", w)
		}
	}
}
