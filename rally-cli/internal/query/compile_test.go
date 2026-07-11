package query

import (
	"strings"
	"testing"
)

func TestCompile(t *testing.T) {
	cases := []struct {
		name    string
		filters []string
		want    string
	}{
		{"equals", []string{`State = Defined`}, `(State = "Defined")`},
		{"equals no spaces", []string{`State=Defined`}, `(State = "Defined")`},
		{"not equals", []string{`State!=Closed`}, `(State != "Closed")`},
		{"gt", []string{`PlanEstimate>3`}, `(PlanEstimate > 3)`},
		{"lt", []string{`PlanEstimate<3`}, `(PlanEstimate < 3)`},
		{"gte does not split", []string{`Estimate>=5`}, `(Estimate >= 5)`},
		{"lte", []string{`Estimate<=5.5`}, `(Estimate <= 5.5)`},
		{"contains", []string{`Name contains login`}, `(Name contains "login")`},
		{"not contains", []string{`Name !contains login`}, `(Name !contains "login")`},
		{"dotted field", []string{`Iteration.Name = Sprint 12`}, `(Iteration.Name = "Sprint 12")`},
		{"null bare", []string{`Iteration = null`}, `(Iteration = null)`},
		{"bool bare", []string{`Disabled = false`}, `(Disabled = false)`},
		{"negative number bare", []string{`ToDo > -1`}, `(ToDo > -1)`},
		{"ref bare", []string{`Project = /project/123`}, `(Project = /project/123)`},
		{"value with spaces quoted", []string{`Name = North America Launch`}, `(Name = "North America Launch")`},
		{
			"two filters paired parens",
			[]string{`State = Defined`, `Severity = Critical`},
			`((State = "Defined") AND (Severity = "Critical"))`,
		},
		{
			"three filters left fold",
			[]string{`State = Defined`, `Severity = Critical`, `Owner.UserName = a@b.com`},
			`(((State = "Defined") AND (Severity = "Critical")) AND (Owner.UserName = "a@b.com"))`,
		},
		{"empty input", nil, ""},
		{"whitespace tolerated", []string{`  State   =   Defined  `}, `(State = "Defined")`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Compile(tc.filters)
			if err != nil {
				t.Fatalf("Compile(%v) error: %v", tc.filters, err)
			}
			if got != tc.want {
				t.Errorf("Compile(%v) = %q, want %q", tc.filters, got, tc.want)
			}
		})
	}
}

func TestCompileErrors(t *testing.T) {
	cases := []struct {
		name    string
		filters []string
		wantSub string
	}{
		{"no operator", []string{`Justaword`}, "expected Field OPERATOR value"},
		{"empty value", []string{`State =`}, "missing value"},
		{"embedded quote", []string{`Name = say "hi"`}, "double quotes"},
		{"leading digit field", []string{`1Field = x`}, "expected Field OPERATOR value"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Compile(tc.filters)
			if err == nil {
				t.Fatalf("Compile(%v) expected error", tc.filters)
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Errorf("Compile(%v) error %q does not contain %q", tc.filters, err, tc.wantSub)
			}
		})
	}
}
