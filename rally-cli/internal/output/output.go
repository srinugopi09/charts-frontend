// Package output renders query results for two audiences: humans (aligned
// tables on a TTY) and agents (compact, cleaned JSON when piped). stdout
// carries only data; all diagnostics go to stderr.
package output

import (
	"fmt"
	"os"

	"golang.org/x/term"
)

type Format string

const (
	FormatTable Format = "table"
	FormatJSON  Format = "json"
	FormatCSV   Format = "csv"
)

// Detect picks the output format: the explicit flag wins; otherwise table on
// a TTY and JSON when piped (so `rally stories | jq .` and agent subprocess
// calls need zero flags).
func Detect(flag string) (Format, error) {
	switch flag {
	case "":
		if StdoutIsTTY() {
			return FormatTable, nil
		}
		return FormatJSON, nil
	case "table", "json", "csv":
		return Format(flag), nil
	default:
		return "", fmt.Errorf("invalid output format %q (valid: table, json, csv)", flag)
	}
}

func StdoutIsTTY() bool {
	return term.IsTerminal(int(os.Stdout.Fd()))
}

// Options tune rendering across all formats.
type Options struct {
	Format   Format
	Columns  []string // table/csv column order
	Pretty   bool     // indent JSON
	KeepRefs bool     // keep _ref/ObjectID handles in JSON
	Raw      bool     // emit Rally's objects verbatim (JSON only)
}
