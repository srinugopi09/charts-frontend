package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/srinugopi09/rally-cli/internal/config"
	"github.com/srinugopi09/rally-cli/internal/output"
)

func (a *app) configCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Get and set CLI configuration (api_key, base_url, workspace, project)",
		Long: `Manage the config file at ` + config.Path() + `.
Keys: ` + strings.Join(config.Keys, ", ") + `
Precedence: flag > env (RALLY_API_KEY, RALLY_BASE_URL, RALLY_WORKSPACE, RALLY_PROJECT) > config file > default.`,
		Example: `  rally config set api_key <key>
  rally config set workspace 12345
  rally config list
  rally config path`,
	}
	cmd.AddCommand(a.configListCmd(), a.configGetCmd(), a.configSetCmd(), a.configUnsetCmd(), a.configPathCmd())
	return cmd
}

func (a *app) configListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "Show effective configuration with sources (secrets masked)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			effective := map[string]string{
				"api_key":   config.Mask(a.cfg.APIKey),
				"base_url":  a.cfg.BaseURL,
				"workspace": a.cfg.Workspace,
				"project":   a.cfg.Project,
			}
			if a.format == output.FormatJSON {
				return output.WriteJSONValue(a.stdout, map[string]any{
					"config": effective, "sources": a.cfg.Sources, "path": config.Path(),
				}, a.pretty)
			}
			for _, key := range config.Keys {
				value := effective[key]
				if value == "" {
					value = "—"
				}
				source := a.cfg.Sources[key]
				if source == "" {
					source = "unset"
				}
				fmt.Fprintf(a.stdout, "%-10s %-30s (%s)\n", key, value, source)
			}
			fmt.Fprintf(a.stderr, "config file: %s\n", config.Path())
			return nil
		},
	}
}

func (a *app) configGetCmd() *cobra.Command {
	return &cobra.Command{
		Use:       "get <key>",
		Short:     "Print one effective config value (unmasked)",
		Args:      cobra.ExactArgs(1),
		ValidArgs: config.Keys,
		RunE: func(cmd *cobra.Command, args []string) error {
			field, ok := a.cfg.FieldFor(args[0])
			if !ok {
				return usageError(fmt.Sprintf("unknown config key %q (valid: %s)", args[0], strings.Join(config.Keys, ", ")))
			}
			if *field != "" {
				fmt.Fprintln(a.stdout, *field)
			}
			return nil
		},
	}
}

func (a *app) configSetCmd() *cobra.Command {
	return &cobra.Command{
		Use:       "set <key> <value>",
		Short:     "Set a config value in the config file",
		Args:      cobra.ExactArgs(2),
		ValidArgs: config.Keys,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.mutateConfigFile(args[0], args[1])
		},
	}
}

func (a *app) configUnsetCmd() *cobra.Command {
	return &cobra.Command{
		Use:       "unset <key>",
		Short:     "Remove a config value from the config file",
		Args:      cobra.ExactArgs(1),
		ValidArgs: config.Keys,
		RunE: func(cmd *cobra.Command, args []string) error {
			return a.mutateConfigFile(args[0], "")
		},
	}
}

func (a *app) configPathCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "path",
		Short: "Print the config file path",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Fprintln(a.stdout, config.Path())
			return nil
		},
	}
}

// mutateConfigFile writes to the file only — env vars and flags are never
// persisted.
func (a *app) mutateConfigFile(key, value string) error {
	fileCfg, err := config.LoadFile()
	if err != nil {
		return err
	}
	field, ok := fileCfg.FieldFor(key)
	if !ok {
		return usageError(fmt.Sprintf("unknown config key %q (valid: %s)", key, strings.Join(config.Keys, ", ")))
	}
	*field = value
	if err := config.Save(fileCfg); err != nil {
		return err
	}
	if value == "" {
		fmt.Fprintf(a.stderr, "unset %s in %s\n", key, config.Path())
	} else {
		fmt.Fprintf(a.stderr, "set %s in %s\n", key, config.Path())
	}
	return nil
}
