package cli

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/output"
)

const wsapiVersion = "v2.0"

func (a *app) versionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if a.format == output.FormatJSON {
				return output.WriteJSONValue(a.stdout, map[string]string{
					"version": a.version,
					"commit":  a.commit,
					"wsapi":   wsapiVersion,
				}, a.pretty)
			}
			fmt.Fprintf(a.stdout, "rally %s (commit %s, WSAPI %s)\n", a.version, a.commit, wsapiVersion)
			return nil
		},
	}
}
