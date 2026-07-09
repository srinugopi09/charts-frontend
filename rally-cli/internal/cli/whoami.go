package cli

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/output"
	"github.com/srinugopi09/rally-cli/internal/rally"
)

var whoamiColumns = []string{"UserName", "DisplayName", "EmailAddress", "Disabled", "LastLoginDate"}

func (a *app) whoamiCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "whoami",
		Short:   "Show the authenticated Rally user (verifies your setup)",
		Example: "  rally whoami\n  rally whoami -o json",
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := a.client()
			if err != nil {
				return err
			}
			// GET /user returns the authenticated user as a single object.
			raw, err := client.Do(cmd.Context(), "GET", "user",
				url.Values{"fetch": {strings.Join(whoamiColumns, ",")}}, nil)
			if err != nil {
				return err
			}
			obj, err := rally.SingleObject(raw)
			if err != nil {
				return err
			}
			if source, ok := a.cfg.Sources["api_key"]; ok {
				fmt.Fprintf(a.stderr, "rally: authenticated with api key from %s\n", source)
			} else if a.cfg.Username != "" {
				fmt.Fprintln(a.stderr, "rally: authenticated with basic auth from env RALLY_USERNAME")
			}
			if a.format == output.FormatJSON {
				return output.WriteJSONObject(a.stdout, obj, a.renderOpts(whoamiColumns))
			}
			return output.WriteKV(a.stdout, obj, whoamiColumns)
		},
	}
}
