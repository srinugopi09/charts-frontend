package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/output"
	"github.com/srinugopi09/rally-cli/internal/query"
	"github.com/srinugopi09/rally-cli/internal/rally"
)

// queryFlags are shared by `rally query` and the alias subcommands.
type queryFlags struct {
	rawQuery  string
	filters   []string
	fetch     string
	order     string
	limit     int
	all       bool
	pageSize  int
	start     int
	scopeUp   bool
	scopeDown bool
	count     bool
	iteration string // only registered on stories/defects
}

func addQueryFlags(cmd *cobra.Command, qf *queryFlags) {
	f := cmd.Flags()
	f.StringVarP(&qf.rawQuery, "query", "q", "", `raw Rally query, passed through verbatim: '(State = "Defined")'`)
	f.StringArrayVarP(&qf.filters, "filter", "f", nil, `simple filter "Field OP value" (OP: = != > < >= <= contains !contains); repeat for AND. OR needs --query`)
	f.StringVar(&qf.fetch, "fetch", "", "comma-separated fields to fetch (default: the type's standard columns; 'true' fetches all)")
	f.StringVar(&qf.order, "order", "", `sort order, e.g. "CreationDate DESC" (default: FormattedID ASC)`)
	f.IntVarP(&qf.limit, "limit", "n", 20, "maximum results to return (auto-paginates)")
	f.BoolVar(&qf.all, "all", false, "fetch every matching result (overrides --limit; capped by --max-requests)")
	f.IntVar(&qf.pageSize, "page-size", 0, "WSAPI pagesize per request (default: auto; server cap 2000)")
	f.IntVar(&qf.start, "start", 0, "1-based start index for manual paging")
	f.BoolVar(&qf.scopeUp, "scope-up", false, "include parent projects (projectScopeUp=true)")
	f.BoolVar(&qf.scopeDown, "scope-down", true, "include child projects (Rally default true; --scope-down=false to disable)")
	f.BoolVar(&qf.count, "count", false, "print only the total result count (a bare integer)")
}

func (a *app) queryCmd() *cobra.Command {
	qf := &queryFlags{}
	cmd := &cobra.Command{
		Use:   "query <type>",
		Short: "Query any Rally WSAPI type",
		Long: `Query any Rally WSAPI type by name (hierarchicalrequirement, defect, task,
portfolioitem/feature, ...) or friendly alias (story, defect, feature, ...).
This is the canonical command — rally stories, rally defects etc. are sugar for it.
Discover types with: rally schema`,
		Example: `  rally query defect -f 'State != Closed' -f 'Severity = Critical' --order "CreationDate DESC"
  rally query hierarchicalrequirement -q '((Iteration.Name = "Sprint 12") AND (ScheduleState < Accepted))' --all
  rally query portfolioitem/feature --fetch FormattedID,Name,State -n 50 -o json
  rally query defect --count`,
		Args:              cobra.ExactArgs(1),
		ValidArgsFunction: completeTypeNames,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.runQuery(cmd, args[0], qf)
		},
	}
	addQueryFlags(cmd, qf)
	return cmd
}

// runQuery is the single query path behind `rally query` and every alias.
func (a *app) runQuery(cmd *cobra.Command, typeName string, qf *queryFlags) error {
	ti := rally.ResolveType(typeName)

	queryString, err := buildQueryString(qf)
	if err != nil {
		return err
	}
	if a.verbose && queryString != "" && qf.rawQuery == "" {
		fmt.Fprintf(a.stderr, "rally: compiled query: %s\n", queryString)
	}

	fetch, columns := resolveFetch(qf.fetch, ti)
	order := qf.order
	if order == "" {
		order = ti.DefaultOrder()
	}
	workspace, err := normalizeScopeRef("workspace", a.cfg.Workspace)
	if err != nil {
		return err
	}
	project, err := normalizeScopeRef("project", a.cfg.Project)
	if err != nil {
		return err
	}

	params := rally.QueryParams{
		Query:     queryString,
		Fetch:     fetch,
		Order:     order,
		Workspace: workspace,
		Project:   project,
		Start:     qf.start,
		PageSize:  qf.pageSize,
	}
	if qf.scopeUp {
		params.ScopeUp = &qf.scopeUp
	}
	if cmd.Flags().Changed("scope-down") {
		params.ScopeDown = &qf.scopeDown
	}

	client, err := a.client()
	if err != nil {
		return err
	}
	ctx := cmd.Context()

	if qf.count {
		countParams := params
		countParams.PageSize = 1
		countParams.Fetch = "ObjectID"
		qr, err := client.Query(ctx, ti.Name, countParams)
		if err != nil {
			return err
		}
		a.warn(qr.Warnings)
		fmt.Fprintln(a.stdout, qr.TotalResultCount)
		return nil
	}

	limit := qf.limit
	if qf.all {
		limit = 0
	}
	results, total, err := client.QueryAll(ctx, ti.Name, params, limit, a.maxRequests)
	if err != nil {
		return err
	}

	startIndex := qf.start
	if startIndex <= 0 {
		startIndex = 1
	}
	opts := a.renderOpts(columns)
	switch a.format {
	case output.FormatJSON:
		return output.WriteJSONResults(a.stdout, results, total, startIndex, nil, opts)
	case output.FormatCSV:
		return output.WriteCSV(a.stdout, results, columns)
	default:
		if err := output.WriteTable(a.stdout, results, columns); err != nil {
			return err
		}
		if total > len(results) {
			fmt.Fprintf(a.stderr, "Showing %d of %d results (use --all or -n <count> to fetch more)\n", len(results), total)
		}
		return nil
	}
}

// buildQueryString merges --query, --filter, and the --iteration sugar.
func buildQueryString(qf *queryFlags) (string, error) {
	if qf.rawQuery != "" && (len(qf.filters) > 0 || qf.iteration != "") {
		return "", usageError("--query and --filter are mutually exclusive: --filter compiles into the query language (run with -v to see the compiled form), --query passes through verbatim")
	}
	if qf.rawQuery != "" {
		return qf.rawQuery, nil
	}
	filters := qf.filters
	if qf.iteration != "" {
		filters = append([]string{"Iteration.Name = " + qf.iteration}, filters...)
	}
	compiled, err := query.Compile(filters)
	if err != nil {
		return "", usageError(err.Error())
	}
	return compiled, nil
}

// resolveFetch decides both the WSAPI fetch param and the table/CSV columns,
// so what we fetch and what we show always agree.
func resolveFetch(flag string, ti rally.TypeInfo) (fetch string, columns []string) {
	if flag == "" {
		return strings.Join(ti.DefaultColumns, ","), ti.DefaultColumns
	}
	if flag == "true" {
		return "true", ti.DefaultColumns
	}
	parts := strings.Split(flag, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return strings.Join(parts, ","), parts
}

// completeTypeNames offers registry names and aliases for shell completion.
func completeTypeNames(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	if len(args) > 0 {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	var names []string
	for _, t := range rally.Registry {
		names = append(names, t.Name)
	}
	return names, cobra.ShellCompDirectiveNoFileComp
}
