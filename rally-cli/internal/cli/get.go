package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/output"
	"github.com/srinugopi09/rally-cli/internal/rally"
)

func (a *app) getCmd() *cobra.Command {
	var fetch, typeFlag, collection string
	cmd := &cobra.Command{
		Use:   "get <FormattedID | type/ObjectID>",
		Short: "Fetch one object by FormattedID (US123) or type/ObjectID",
		Long: `Fetch a single Rally object. The type is inferred from the FormattedID
prefix (US, DE, TA, TC, TS, DS, F, E, I); unknown prefixes fall back to a
cross-type artifact search. FormattedIDs are workspace-scoped.`,
		Example: `  rally get US123
  rally get DE45 --fetch true          # every field
  rally get defect/4321987654          # explicit type/ObjectID
  rally get ABC12 --type defect        # force the type for custom prefixes
  rally get US123 --collection Tasks   # list a story's tasks`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.runGet(cmd.Context(), args[0], fetch, typeFlag, collection)
		},
	}
	cmd.Flags().StringVar(&fetch, "fetch", "", "comma-separated fields (default: the type's standard columns; 'true' fetches all)")
	cmd.Flags().StringVar(&typeFlag, "type", "", "force the WSAPI type instead of inferring from the ID prefix")
	cmd.Flags().StringVar(&collection, "collection", "", "follow a collection field (e.g. Tasks, Defects, Discussion) and list its members")
	return cmd
}

func (a *app) runGet(ctx context.Context, arg, fetchFlag, typeFlag, collection string) error {
	client, err := a.client()
	if err != nil {
		return err
	}

	obj, ti, err := a.resolveObject(ctx, client, arg, fetchFlag, typeFlag, collection)
	if err != nil {
		return err
	}
	if collection != "" {
		return a.renderCollection(ctx, client, obj, arg, collection)
	}

	_, columns := resolveFetch(fetchFlag, ti)
	opts := a.renderOpts(columns)
	switch a.format {
	case output.FormatJSON:
		return output.WriteJSONObject(a.stdout, obj, opts)
	case output.FormatCSV:
		return output.WriteCSV(a.stdout, []json.RawMessage{obj}, columns)
	default:
		return output.WriteKV(a.stdout, obj, columns)
	}
}

// resolveObject implements the get resolution algorithm:
// type/ObjectID → direct GET; known FormattedID prefix → typed query;
// unknown prefix or no hit → cross-type artifact search.
func (a *app) resolveObject(ctx context.Context, client *rally.Client, arg, fetchFlag, typeFlag, collection string) (json.RawMessage, rally.TypeInfo, error) {
	if typ, oid, ok := rally.ParseTypeOID(arg); ok && typeFlag == "" {
		ti := rally.ResolveType(typ)
		fetch := getFetch(fetchFlag, ti, collection)
		obj, err := client.Get(ctx, ti.Name, oid, fetch)
		return obj, ti, err
	}

	prefix, isFormattedID := rally.ParseFormattedID(arg)
	if !isFormattedID {
		return nil, rally.TypeInfo{}, usageError(fmt.Sprintf("%q is not a FormattedID (like US123) or type/ObjectID (like defect/4321987654)", arg))
	}
	id := strings.ToUpper(strings.TrimSpace(arg))

	if typeFlag != "" {
		ti := rally.ResolveType(typeFlag)
		obj, err := a.queryByFormattedID(ctx, client, ti, id, getFetch(fetchFlag, ti, collection))
		return obj, ti, err
	}

	if ti, known := rally.TypeForPrefix(prefix); known {
		obj, err := a.queryByFormattedID(ctx, client, ti, id, getFetch(fetchFlag, ti, collection))
		if err == nil {
			return obj, ti, nil
		}
		var notFound *rally.NotFoundError
		if !errors.As(err, &notFound) {
			return nil, ti, err
		}
		// fall through to the artifact search: prefixes are workspace-configurable
	}

	// Cross-type search. `artifact` spans stories/defects/tasks/etc.; the
	// result's _type says what we found, so we can apply proper defaults.
	artifactType := rally.TypeInfo{Name: "artifact", DefaultColumns: rally.GenericColumns, HasFormattedID: true}
	fetch := fetchFlag
	if fetch == "" {
		fetch = "true"
	}
	obj, err := a.queryByFormattedID(ctx, client, artifactType, id, fetch)
	if err != nil {
		return nil, artifactType, err
	}
	ti := artifactType
	var typed struct {
		Type string `json:"_type"`
	}
	if json.Unmarshal(obj, &typed) == nil && typed.Type != "" {
		ti = rally.ResolveType(typed.Type)
	}
	return obj, ti, nil
}

func (a *app) queryByFormattedID(ctx context.Context, client *rally.Client, ti rally.TypeInfo, id, fetch string) (json.RawMessage, error) {
	workspace, err := normalizeScopeRef("workspace", a.cfg.Workspace)
	if err != nil {
		return nil, err
	}
	qr, err := client.Query(ctx, ti.Name, rally.QueryParams{
		Query:     `(FormattedID = "` + id + `")`,
		Fetch:     fetch,
		Workspace: workspace,
		PageSize:  2,
	})
	if err != nil {
		return nil, err
	}
	a.warn(qr.Warnings)
	switch len(qr.Results) {
	case 0:
		return nil, &rally.NotFoundError{What: id}
	case 1:
		return qr.Results[0], nil
	default:
		return nil, &ExitError{Code: ExitNotFound, ErrCode: "ambiguous_id",
			Message: fmt.Sprintf("%s matches %d objects (total %d); disambiguate with --type or get by type/ObjectID", id, len(qr.Results), qr.TotalResultCount)}
	}
}

// getFetch: like resolveFetch but ensures a requested collection field is
// actually fetched, since we need its _ref to follow it.
func getFetch(flag string, ti rally.TypeInfo, collection string) string {
	fetch, _ := resolveFetch(flag, ti)
	if collection != "" && fetch != "true" && !containsField(fetch, collection) {
		fetch += "," + collection
	}
	return fetch
}

func containsField(fetch, field string) bool {
	for _, f := range strings.Split(fetch, ",") {
		if strings.EqualFold(strings.TrimSpace(f), field) {
			return true
		}
	}
	return false
}

// renderCollection follows obj.<collection>._ref and prints its members.
func (a *app) renderCollection(ctx context.Context, client *rally.Client, obj json.RawMessage, arg, collection string) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(obj, &fields); err != nil {
		return err
	}
	rawField, ok := fields[collection]
	if !ok {
		return &ExitError{Code: ExitNotFound, ErrCode: "not_found",
			Message: fmt.Sprintf("%s has no collection %q; discover fields with: rally schema <type>", arg, collection)}
	}
	var collRef struct {
		Ref   string `json:"_ref"`
		Count int    `json:"Count"`
	}
	if err := json.Unmarshal(rawField, &collRef); err != nil || collRef.Ref == "" {
		return &ExitError{Code: ExitUsage, ErrCode: "usage",
			Message: fmt.Sprintf("%s.%s is not a collection field", arg, collection)}
	}

	// Guess the element type from the collection name (Tasks → task) to pick
	// sensible default columns; fall back to generic ones.
	elemType := rally.ResolveType(strings.TrimSuffix(strings.ToLower(collection), "s"))
	columns := elemType.DefaultColumns

	params := rally.QueryParams{
		Fetch:    strings.Join(columns, ","),
		PageSize: rally.MaxPageSize,
	}
	// Only registry types get a server-side Order — Rally rejects sorting on
	// attributes the element type doesn't have (e.g. FormattedID on
	// ConversationPost), and for guessed types we can't know. Sort locally
	// instead for those.
	if elemType.Known {
		params.Order = elemType.DefaultOrder()
	}
	qr, err := client.QueryURL(ctx, collRef.Ref, params)
	if err != nil {
		return err
	}
	a.warn(qr.Warnings)
	if !elemType.Known {
		sortRawByField(qr.Results, "ObjectID")
	}

	opts := a.renderOpts(columns)
	switch a.format {
	case output.FormatJSON:
		return output.WriteJSONResults(a.stdout, qr.Results, qr.TotalResultCount, 1, nil, opts)
	case output.FormatCSV:
		return output.WriteCSV(a.stdout, qr.Results, columns)
	default:
		return output.WriteTable(a.stdout, qr.Results, columns)
	}
}
