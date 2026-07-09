package cli

import (
	"github.com/spf13/cobra"
)

// aliasCmds registers thin, discoverable subcommands for everyday types.
// Each is sugar over the exact same runQuery path as `rally query`.
func (a *app) aliasCmds() []*cobra.Command {
	specs := []struct {
		use, typ  string
		iteration bool // register the --iteration convenience flag
	}{
		{"stories", "hierarchicalrequirement", true},
		{"defects", "defect", true},
		{"tasks", "task", false},
		{"testcases", "testcase", false},
		{"features", "portfolioitem/feature", false},
		{"epics", "portfolioitem/epic", false},
		{"iterations", "iteration", false},
		{"releases", "release", false},
		{"milestones", "milestone", false},
		{"users", "user", false},
	}
	cmds := make([]*cobra.Command, 0, len(specs))
	for _, spec := range specs {
		spec := spec
		qf := &queryFlags{}
		cmd := &cobra.Command{
			Use:     spec.use,
			Short:   "Alias for: rally query " + spec.typ,
			Example: "  rally " + spec.use + " -f 'Owner.UserName = jane@example.com' -n 50",
			Args:    cobra.NoArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				return a.runQuery(cmd, spec.typ, qf)
			},
		}
		addQueryFlags(cmd, qf)
		if spec.iteration {
			cmd.Flags().StringVar(&qf.iteration, "iteration", "", `filter by iteration name: shorthand for -f 'Iteration.Name = <name>'`)
			cmd.Example = "  rally " + spec.use + ` --iteration "Sprint 12"` + "\n" + cmd.Example
		}
		cmds = append(cmds, cmd)
	}
	return cmds
}
