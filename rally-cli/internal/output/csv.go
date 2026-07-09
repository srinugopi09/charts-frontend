package output

import (
	"encoding/csv"
	"encoding/json"
	"io"
)

// WriteCSV renders results as RFC 4180 CSV: header row once, full
// untruncated values. The most token-efficient bulk format for agents
// (field names are not repeated per row) and ready for spreadsheets.
func WriteCSV(w io.Writer, raws []json.RawMessage, columns []string) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(columns); err != nil {
		return err
	}
	for _, raw := range raws {
		obj := decode(raw)
		row := make([]string, len(columns))
		for i, col := range columns {
			display, ok := DisplayValue(obj[col])
			if ok {
				row[i] = display
			}
		}
		if err := cw.Write(row); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}
