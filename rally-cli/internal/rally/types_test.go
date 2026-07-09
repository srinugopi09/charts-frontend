package rally

import "testing"

func TestResolveType(t *testing.T) {
	cases := map[string]string{
		"story":                    "hierarchicalrequirement",
		"stories":                  "hierarchicalrequirement",
		"hierarchicalrequirement":  "hierarchicalrequirement",
		"US":                       "hierarchicalrequirement",
		"defect":                   "defect",
		"bugs":                     "defect",
		"feature":                  "portfolioitem/feature",
		"portfolioitem/feature":    "portfolioitem/feature",
		"sprints":                  "iteration",
		"conversationpost":         "conversationpost", // unknown → passthrough
		"PortfolioItem/Initiative": "portfolioitem/initiative",
	}
	for in, want := range cases {
		if got := ResolveType(in).Name; got != want {
			t.Errorf("ResolveType(%q).Name = %q, want %q", in, got, want)
		}
	}
	if cols := ResolveType("somethingunknown").DefaultColumns; len(cols) != len(GenericColumns) {
		t.Errorf("unknown type should get generic columns, got %v", cols)
	}
}

func TestParseFormattedID(t *testing.T) {
	for in, wantPrefix := range map[string]string{"US123": "US", "de45": "DE", "TA9": "TA", "F100": "F"} {
		prefix, ok := ParseFormattedID(in)
		if !ok || prefix != wantPrefix {
			t.Errorf("ParseFormattedID(%q) = %q,%v, want %q,true", in, prefix, ok, wantPrefix)
		}
	}
	for _, bad := range []string{"US", "123", "US-123", "defect/123", ""} {
		if _, ok := ParseFormattedID(bad); ok {
			t.Errorf("ParseFormattedID(%q) should not parse", bad)
		}
	}
}

func TestTypeForPrefix(t *testing.T) {
	cases := map[string]string{
		"US": "hierarchicalrequirement", "DE": "defect", "TA": "task",
		"TC": "testcase", "TS": "testset", "DS": "defectsuite",
		"F": "portfolioitem/feature", "E": "portfolioitem/epic", "I": "portfolioitem/initiative",
	}
	for prefix, want := range cases {
		ti, ok := TypeForPrefix(prefix)
		if !ok || ti.Name != want {
			t.Errorf("TypeForPrefix(%q) = %q,%v, want %q,true", prefix, ti.Name, ok, want)
		}
	}
	if _, ok := TypeForPrefix("ZZ"); ok {
		t.Error("TypeForPrefix(ZZ) should be unknown")
	}
}

func TestParseTypeOID(t *testing.T) {
	typ, oid, ok := ParseTypeOID("defect/4321987654")
	if !ok || typ != "defect" || oid != "4321987654" {
		t.Errorf("got %q %q %v", typ, oid, ok)
	}
	typ, oid, ok = ParseTypeOID("portfolioitem/feature/123")
	if !ok || typ != "portfolioitem/feature" || oid != "123" {
		t.Errorf("got %q %q %v", typ, oid, ok)
	}
	for _, bad := range []string{"US123", "defect/", "/123", "defect/12a3"} {
		if _, _, ok := ParseTypeOID(bad); ok {
			t.Errorf("ParseTypeOID(%q) should not parse", bad)
		}
	}
}

func TestDefaultOrder(t *testing.T) {
	if got := ResolveType("defect").DefaultOrder(); got != "FormattedID ASC" {
		t.Errorf("defect order = %q", got)
	}
	if got := ResolveType("iteration").DefaultOrder(); got != "ObjectID ASC" {
		t.Errorf("iteration order = %q", got)
	}
}
