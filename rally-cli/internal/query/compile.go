// Package query compiles simple --filter expressions into Rally's query
// language, which requires every binary operation to be a parenthesized pair:
//
//	1 filter:  (State = "Defined")
//	2 filters: ((State = "Defined") AND (Severity = "Critical"))
//	3 filters: (((State = "Defined") AND (Severity = "Critical")) AND (Owner.UserName = "a@b.com"))
//
// Repeated filters are AND-joined; OR requires raw --query passthrough.
package query

import (
	"fmt"
	"regexp"
	"strings"
)

// symbolExpr matches `Field OP value` for symbol operators, longest-first so
// `Estimate>=5` doesn't split as `>` + `=5`.
var symbolExpr = regexp.MustCompile(`^\s*([A-Za-z][A-Za-z0-9._]*)\s*(>=|<=|!=|=|>|<)\s*(.*?)\s*$`)

// wordExpr matches the word operators, which need whitespace delimiters.
var wordExpr = regexp.MustCompile(`^\s*([A-Za-z][A-Za-z0-9._]*)\s+(!?contains)\s+(.*?)\s*$`)

var bareValueRe = regexp.MustCompile(`^(null|true|false|-?\d+(\.\d+)?|/[a-z][a-z/]*/\d+|https?://\S+)$`)

// Compile turns one or more --filter expressions into a single Rally query.
func Compile(filters []string) (string, error) {
	var parts []string
	for _, f := range filters {
		expr, err := compileOne(f)
		if err != nil {
			return "", err
		}
		parts = append(parts, expr)
	}
	if len(parts) == 0 {
		return "", nil
	}
	combined := parts[0]
	for _, next := range parts[1:] {
		combined = "(" + combined + " AND " + next + ")"
	}
	return combined, nil
}

func compileOne(filter string) (string, error) {
	m := wordExpr.FindStringSubmatch(filter)
	if m == nil {
		m = symbolExpr.FindStringSubmatch(filter)
	}
	if m == nil {
		return "", fmt.Errorf("invalid filter %q: expected Field OPERATOR value, where OPERATOR is one of = != > < >= <= contains !contains (e.g. --filter 'State != Closed')", filter)
	}
	field, op, value := m[1], m[2], m[3]
	if value == "" {
		return "", fmt.Errorf("invalid filter %q: missing value after %q", filter, op)
	}
	quoted, err := quoteValue(value)
	if err != nil {
		return "", fmt.Errorf("invalid filter %q: %w", filter, err)
	}
	return "(" + field + " " + op + " " + quoted + ")", nil
}

// quoteValue wraps the value in double quotes unless it is a bare literal
// (null/true/false/number) or a ref path, which Rally expects unquoted.
func quoteValue(v string) (string, error) {
	if bareValueRe.MatchString(v) {
		return v, nil
	}
	if strings.Contains(v, `"`) {
		return "", fmt.Errorf(`values may not contain double quotes (Rally's query language has no escape); rephrase with 'contains' on a substring without quotes`)
	}
	return `"` + v + `"`, nil
}
