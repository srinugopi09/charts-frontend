package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/output"
	"github.com/srinugopi09/rally-cli/internal/rally"
)

var (
	typeListColumns  = []string{"ElementName", "TypePath", "Name", "Parent"}
	attributeColumns = []string{"ElementName", "AttributeType", "Required", "ReadOnly", "Constrained", "Custom"}
)

func (a *app) schemaCmd() *cobra.Command {
	var withValues bool
	cmd := &cobra.Command{
		Use:   "schema [type]",
		Short: "Discover Rally types and their fields (including custom c_* fields)",
		Long: `Without arguments, lists every queryable WSAPI type. With a type, lists its
fields from Rally's live metadata — names, types, whether they are required,
read-only, or constrained to a value list. This is how agents (and humans)
discover what --fetch, --filter, and --order can reference.`,
		Example: `  rally schema
  rally schema defect
  rally schema defect --values     # include allowed values for constrained fields
  rally schema story -o json`,
		Args:              cobra.MaximumNArgs(1),
		ValidArgsFunction: completeTypeNames,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return a.runSchemaTypes(cmd.Context())
			}
			return a.runSchemaAttributes(cmd.Context(), args[0], withValues)
		},
	}
	cmd.Flags().BoolVar(&withValues, "values", false, "fetch allowed values for constrained fields (one extra request per constrained field)")
	return cmd
}

func (a *app) runSchemaTypes(ctx context.Context) error {
	client, err := a.client()
	if err != nil {
		return err
	}
	workspace, err := normalizeScopeRef("workspace", a.cfg.Workspace)
	if err != nil {
		return err
	}
	// No server-side Order here: Rally rejects sorting TypeDefinition by
	// ElementName ("Cannot sort using attribute ElementName"); sort locally.
	results, total, err := client.QueryAll(ctx, "typedefinition", rally.QueryParams{
		Fetch:     strings.Join(typeListColumns, ","),
		Workspace: workspace,
	}, 0, a.maxRequests)
	if err != nil {
		return err
	}
	sortRawByField(results, "ElementName")
	return a.renderResults(results, total, typeListColumns)
}

func (a *app) runSchemaAttributes(ctx context.Context, typeName string, withValues bool) error {
	client, err := a.client()
	if err != nil {
		return err
	}
	ti := rally.ResolveType(typeName)
	workspace, err := normalizeScopeRef("workspace", a.cfg.Workspace)
	if err != nil {
		return err
	}

	// Find the type definition; match TypePath (portfolioitem/feature) or
	// ElementName (Defect) — Rally string comparison is case-insensitive.
	elementName := ti.Name
	if idx := strings.LastIndex(elementName, "/"); idx >= 0 {
		elementName = elementName[idx+1:]
	}
	qr, err := client.Query(ctx, "typedefinition", rally.QueryParams{
		Query:     fmt.Sprintf(`((TypePath = "%s") OR (ElementName = "%s"))`, ti.Name, elementName),
		Fetch:     "ElementName,TypePath,Attributes",
		Workspace: workspace,
		PageSize:  2,
	})
	if err != nil {
		return err
	}
	a.warn(qr.Warnings)
	if len(qr.Results) == 0 {
		return &rally.NotFoundError{What: "type " + typeName + " (list types with: rally schema)"}
	}

	var typeDef struct {
		Attributes struct {
			Ref string `json:"_ref"`
		} `json:"Attributes"`
	}
	if err := json.Unmarshal(qr.Results[0], &typeDef); err != nil || typeDef.Attributes.Ref == "" {
		return fmt.Errorf("type definition for %s has no attributes collection", typeName)
	}

	// No server-side Order: AttributeDefinition rejects it too; sort locally.
	attrs, err := client.QueryURL(ctx, typeDef.Attributes.Ref, rally.QueryParams{
		Fetch:    strings.Join(attributeColumns, ",") + ",AllowedValues",
		PageSize: rally.MaxPageSize,
	})
	if err != nil {
		return err
	}
	a.warn(attrs.Warnings)

	results := attrs.Results
	sortRawByField(results, "ElementName")
	columns := attributeColumns
	if withValues {
		results, err = a.attachAllowedValues(ctx, client, results)
		if err != nil {
			return err
		}
		columns = append(append([]string{}, attributeColumns...), "AllowedValues")
	}
	return a.renderResults(results, attrs.TotalResultCount, columns)
}

// attachAllowedValues replaces each constrained attribute's AllowedValues
// collection ref with the actual list of values.
func (a *app) attachAllowedValues(ctx context.Context, client *rally.Client, attrs []json.RawMessage) ([]json.RawMessage, error) {
	out := make([]json.RawMessage, len(attrs))
	for i, raw := range attrs {
		var attr map[string]any
		if err := json.Unmarshal(raw, &attr); err != nil {
			out[i] = raw
			continue
		}
		constrained, _ := attr["Constrained"].(bool)
		ref := ""
		if av, ok := attr["AllowedValues"].(map[string]any); ok {
			ref, _ = av["_ref"].(string)
		}
		if !constrained || ref == "" {
			delete(attr, "AllowedValues")
		} else {
			qr, err := client.QueryURL(ctx, ref, rally.QueryParams{Fetch: "StringValue", PageSize: rally.MaxPageSize})
			if err != nil {
				return nil, err
			}
			values := make([]string, 0, len(qr.Results))
			for _, v := range qr.Results {
				var item struct {
					StringValue *string `json:"StringValue"`
				}
				if json.Unmarshal(v, &item) == nil && item.StringValue != nil {
					values = append(values, *item.StringValue)
				}
			}
			attr["AllowedValues"] = strings.Join(values, " | ")
		}
		rebuilt, err := json.Marshal(attr)
		if err != nil {
			return nil, err
		}
		out[i] = rebuilt
	}
	return out, nil
}

// sortRawByField orders results client-side by one field. Used where Rally
// rejects server-side sorting (e.g. ElementName on TypeDefinition /
// AttributeDefinition) but the CLI still guarantees deterministic output.
func sortRawByField(results []json.RawMessage, field string) {
	type keyed struct {
		key string
		raw json.RawMessage
	}
	pairs := make([]keyed, len(results))
	for i, raw := range results {
		var obj map[string]any
		if err := json.Unmarshal(raw, &obj); err == nil {
			switch v := obj[field].(type) {
			case string:
				pairs[i].key = v
			case float64:
				pairs[i].key = fmt.Sprintf("%020.0f", v) // zero-pad: lexical == numeric
			}
		}
		pairs[i].raw = raw
	}
	sort.SliceStable(pairs, func(i, j int) bool { return pairs[i].key < pairs[j].key })
	for i := range pairs {
		results[i] = pairs[i].raw
	}
}

// renderResults is the shared result renderer for schema commands.
func (a *app) renderResults(results []json.RawMessage, total int, columns []string) error {
	opts := a.renderOpts(columns)
	switch a.format {
	case output.FormatJSON:
		return output.WriteJSONResults(a.stdout, results, total, 1, nil, opts)
	case output.FormatCSV:
		return output.WriteCSV(a.stdout, results, columns)
	default:
		return output.WriteTable(a.stdout, results, columns)
	}
}
