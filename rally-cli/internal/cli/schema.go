package cli

import (
	"context"
	"encoding/json"
	"fmt"
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
	results, total, err := client.QueryAll(ctx, "typedefinition", rally.QueryParams{
		Fetch:     strings.Join(typeListColumns, ","),
		Order:     "ElementName ASC",
		Workspace: workspace,
	}, 0, a.maxRequests)
	if err != nil {
		return err
	}
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

	attrs, err := client.QueryURL(ctx, typeDef.Attributes.Ref, rally.QueryParams{
		Fetch:    strings.Join(attributeColumns, ",") + ",AllowedValues",
		Order:    "ElementName ASC",
		PageSize: rally.MaxPageSize,
	})
	if err != nil {
		return err
	}
	a.warn(attrs.Warnings)

	results := attrs.Results
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
