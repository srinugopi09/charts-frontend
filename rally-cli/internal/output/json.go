package output

import (
	"encoding/json"
	"io"
)

// Envelope is the agent-facing JSON shape for all query-shaped commands.
// `total` vs `count` tells an agent whether --limit truncated without a
// second call. Empty fields are omitted to save tokens.
type Envelope struct {
	Results    []any    `json:"results"`
	Count      int      `json:"count"`
	Total      int      `json:"total"`
	StartIndex int      `json:"startIndex,omitempty"` // omitted when 1
	Warnings   []string `json:"warnings,omitempty"`
}

// WriteJSONResults renders query results: cleaned by default, verbatim with
// opts.Raw. Compact single-line unless opts.Pretty.
func WriteJSONResults(w io.Writer, raws []json.RawMessage, total, startIndex int, warnings []string, opts Options) error {
	results := make([]any, len(raws))
	for i, raw := range raws {
		results[i] = renderObject(raw, opts)
	}
	if startIndex == 1 {
		startIndex = 0 // omitempty
	}
	return encodeJSON(w, Envelope{
		Results:    results,
		Count:      len(results),
		Total:      total,
		StartIndex: startIndex,
		Warnings:   warnings,
	}, opts.Pretty)
}

// WriteJSONObject renders a single object (rally get) with no envelope.
func WriteJSONObject(w io.Writer, raw json.RawMessage, opts Options) error {
	return encodeJSON(w, renderObject(raw, opts), opts.Pretty)
}

// WriteJSONValue renders an arbitrary value (version info, structured errors).
func WriteJSONValue(w io.Writer, v any, pretty bool) error {
	return encodeJSON(w, v, pretty)
}

func renderObject(raw json.RawMessage, opts Options) any {
	if opts.Raw {
		return raw
	}
	return Clean(raw, opts.KeepRefs)
}

func encodeJSON(w io.Writer, v any, pretty bool) error {
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if pretty {
		enc.SetIndent("", "  ")
	}
	return enc.Encode(v)
}

// ErrorJSON is the structured error written to stderr in JSON mode.
type ErrorJSON struct {
	Code       string   `json:"code"`
	ExitCode   int      `json:"exitCode"`
	Message    string   `json:"message"`
	Details    []string `json:"details,omitempty"`
	HTTPStatus int      `json:"httpStatus,omitempty"`
}

func WriteErrorJSON(w io.Writer, e ErrorJSON) {
	_ = encodeJSON(w, map[string]ErrorJSON{"error": e}, false)
}
