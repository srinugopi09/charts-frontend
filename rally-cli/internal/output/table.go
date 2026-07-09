package output

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"text/tabwriter"
	"unicode/utf8"
)

const maxCellRunes = 60

var isoDateTimeRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}`)

// WriteTable renders one row per object with the given columns, aligned via
// tabwriter. Nulls render as an em-dash, nested refs as their display name,
// dates trimmed to YYYY-MM-DD, long strings truncated (table only).
func WriteTable(w io.Writer, raws []json.RawMessage, columns []string) error {
	tw := tabwriter.NewWriter(w, 0, 4, 2, ' ', 0)
	fmt.Fprintln(tw, strings.Join(upperAll(columns), "\t"))
	for _, raw := range raws {
		obj := decode(raw)
		cells := make([]string, len(columns))
		for i, col := range columns {
			cells[i] = tableCell(obj[col], col)
		}
		fmt.Fprintln(tw, strings.Join(cells, "\t"))
	}
	return tw.Flush()
}

// WriteKV renders a single object vertically (rally get, whoami on a TTY).
func WriteKV(w io.Writer, raw json.RawMessage, columns []string) error {
	obj := decode(raw)
	// Show requested columns first (in order), then any extra fetched fields.
	seen := map[string]bool{}
	tw := tabwriter.NewWriter(w, 0, 4, 2, ' ', 0)
	writeRow := func(key string, value any) {
		display, ok := DisplayValue(value)
		if !ok {
			display = "—"
		}
		display = trimDate(display, key)
		fmt.Fprintf(tw, "%s\t%s\n", key, truncate(display))
	}
	for _, col := range columns {
		if v, ok := obj[col]; ok {
			writeRow(col, v)
			seen[col] = true
		}
	}
	for key, v := range sorted(obj) {
		if !seen[key] && !strings.HasPrefix(key, "_") {
			writeRow(key, v)
		}
	}
	return tw.Flush()
}

func tableCell(value any, column string) string {
	display, ok := DisplayValue(value)
	if !ok {
		return "—"
	}
	display = trimDate(display, column)
	display = strings.ReplaceAll(display, "\t", " ")
	display = strings.ReplaceAll(display, "\n", " ")
	return truncate(display)
}

// trimDate shortens Rally timestamps to their date part in human output.
func trimDate(s, field string) string {
	if strings.HasSuffix(field, "Date") || isoDateTimeRe.MatchString(s) {
		if len(s) >= 10 && isoDateTimeRe.MatchString(s) {
			return s[:10]
		}
	}
	return s
}

func truncate(s string) string {
	if utf8.RuneCountInString(s) <= maxCellRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxCellRunes-1]) + "…"
}

func upperAll(columns []string) []string {
	out := make([]string, len(columns))
	for i, c := range columns {
		out[i] = strings.ToUpper(c)
	}
	return out
}

func decode(raw json.RawMessage) map[string]any {
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		return map[string]any{}
	}
	return obj
}

// sorted iterates a map in deterministic key order.
func sorted(m map[string]any) func(yield func(string, any) bool) {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return func(yield func(string, any) bool) {
		for _, k := range keys {
			if !yield(k, m[k]) {
				return
			}
		}
	}
}
