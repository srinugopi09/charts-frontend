package output

import (
	"encoding/json"
	"strconv"
	"strings"
)

// Clean reduces a raw Rally object to its information-bearing fields. Token
// cost matters for agents: a raw WSAPI object is 60+ fields of refs, UUIDs,
// and API metadata; the cleaned form keeps only fetched fields, collapses
// nested refs to display names, and collections to {"count": n}.
func Clean(raw json.RawMessage, keepRefs bool) map[string]any {
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil {
		return map[string]any{"_undecodable": string(raw)}
	}
	return cleanMap(obj, keepRefs)
}

func cleanMap(obj map[string]any, keepRefs bool) map[string]any {
	out := make(map[string]any, len(obj))
	for key, value := range obj {
		if strings.HasPrefix(key, "_") {
			if keepRefs && key == "_ref" {
				out[key] = value
			}
			continue
		}
		out[key] = cleanValue(value, keepRefs)
	}
	return out
}

func cleanValue(value any, keepRefs bool) any {
	switch v := value.(type) {
	case map[string]any:
		// Nested object ref → its display name.
		if name, ok := v["_refObjectName"].(string); ok {
			if keepRefs {
				collapsed := map[string]any{"name": name}
				if ref, ok := v["_ref"].(string); ok {
					collapsed["_ref"] = ref
				}
				return collapsed
			}
			return name
		}
		// Collection ref → its size.
		if count, ok := v["Count"]; ok {
			if _, hasRef := v["_ref"]; hasRef && len(v) <= 4 {
				collapsed := map[string]any{"count": count}
				if keepRefs {
					collapsed["_ref"] = v["_ref"]
				}
				return collapsed
			}
		}
		return cleanMap(v, keepRefs)
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = cleanValue(item, keepRefs)
		}
		return out
	default:
		return value
	}
}

// DisplayValue extracts a human-readable scalar for table/CSV cells.
func DisplayValue(value any) (string, bool) {
	switch v := value.(type) {
	case nil:
		return "", false
	case string:
		return v, true
	case map[string]any:
		if name, ok := v["_refObjectName"].(string); ok {
			return name, true
		}
		if name, ok := v["name"].(string); ok { // already-cleaned collapsed ref
			return name, true
		}
		for _, key := range []string{"Count", "count"} {
			if count, ok := v[key]; ok {
				return formatScalar(count), true
			}
		}
		b, _ := json.Marshal(v)
		return string(b), true
	default:
		return formatScalar(v), true
	}
}

func formatScalar(v any) string {
	switch n := v.(type) {
	case float64:
		// Rally numbers decode as float64; render ObjectIDs and estimates
		// without scientific notation or trailing zeros.
		return strconv.FormatFloat(n, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(n)
	default:
		b, _ := json.Marshal(v)
		return strings.Trim(string(b), `"`)
	}
}
