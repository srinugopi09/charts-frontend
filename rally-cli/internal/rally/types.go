package rally

import (
	"regexp"
	"strings"
)

// TypeInfo describes one WSAPI type: how users may name it, which
// FormattedID prefixes map to it, and what columns to show by default.
// DefaultColumns double as the default fetch set — never fetch what we
// don't show.
type TypeInfo struct {
	Name           string   // WSAPI path, e.g. "hierarchicalrequirement", "portfolioitem/feature"
	Display        string   // human name for help text
	Aliases        []string // accepted spellings (singular + plural)
	Prefixes       []string // FormattedID prefixes, e.g. "US"
	DefaultColumns []string
	HasFormattedID bool
	Known          bool // true for curated registry entries; false for passthrough guesses
}

func init() {
	for i := range Registry {
		Registry[i].Known = true
	}
}

// Registry lists the everyday Rally types. Unknown types still work through
// `rally query <wsapi-name>` — they just get generic defaults.
var Registry = []TypeInfo{
	{
		Name: "hierarchicalrequirement", Display: "User Story",
		Aliases:        []string{"story", "stories", "userstory", "userstories", "us"},
		Prefixes:       []string{"US"},
		DefaultColumns: []string{"FormattedID", "Name", "ScheduleState", "Owner", "PlanEstimate", "Iteration", "Project"},
		HasFormattedID: true,
	},
	{
		Name: "defect", Display: "Defect",
		Aliases:        []string{"defect", "defects", "bug", "bugs"},
		Prefixes:       []string{"DE"},
		DefaultColumns: []string{"FormattedID", "Name", "State", "Severity", "Priority", "Owner", "Iteration"},
		HasFormattedID: true,
	},
	{
		Name: "task", Display: "Task",
		Aliases:        []string{"task", "tasks"},
		Prefixes:       []string{"TA"},
		DefaultColumns: []string{"FormattedID", "Name", "State", "Owner", "Estimate", "ToDo", "WorkProduct"},
		HasFormattedID: true,
	},
	{
		Name: "testcase", Display: "Test Case",
		Aliases:        []string{"testcase", "testcases", "tc"},
		Prefixes:       []string{"TC"},
		DefaultColumns: []string{"FormattedID", "Name", "Type", "LastVerdict", "Owner"},
		HasFormattedID: true,
	},
	{
		Name: "testset", Display: "Test Set",
		Aliases:        []string{"testset", "testsets"},
		Prefixes:       []string{"TS"},
		DefaultColumns: []string{"FormattedID", "Name", "ScheduleState", "Owner"},
		HasFormattedID: true,
	},
	{
		Name: "defectsuite", Display: "Defect Suite",
		Aliases:        []string{"defectsuite", "defectsuites"},
		Prefixes:       []string{"DS"},
		DefaultColumns: []string{"FormattedID", "Name", "ScheduleState", "Owner"},
		HasFormattedID: true,
	},
	{
		Name: "portfolioitem/feature", Display: "Feature",
		Aliases:        []string{"feature", "features"},
		Prefixes:       []string{"F", "FEA"},
		DefaultColumns: []string{"FormattedID", "Name", "State", "Owner", "PercentDoneByStoryCount"},
		HasFormattedID: true,
	},
	{
		Name: "portfolioitem/epic", Display: "Epic",
		Aliases:        []string{"epic", "epics"},
		Prefixes:       []string{"E", "EPI"},
		DefaultColumns: []string{"FormattedID", "Name", "State", "Owner", "PercentDoneByStoryCount"},
		HasFormattedID: true,
	},
	{
		Name: "portfolioitem/initiative", Display: "Initiative",
		Aliases:        []string{"initiative", "initiatives"},
		Prefixes:       []string{"I"},
		DefaultColumns: []string{"FormattedID", "Name", "State", "Owner", "PercentDoneByStoryCount"},
		HasFormattedID: true,
	},
	{
		Name: "iteration", Display: "Iteration",
		Aliases:        []string{"iteration", "iterations", "sprint", "sprints"},
		DefaultColumns: []string{"Name", "StartDate", "EndDate", "State", "PlannedVelocity"},
	},
	{
		Name: "release", Display: "Release",
		Aliases:        []string{"release", "releases"},
		DefaultColumns: []string{"Name", "ReleaseStartDate", "ReleaseDate", "State"},
	},
	{
		Name: "milestone", Display: "Milestone",
		Aliases:        []string{"milestone", "milestones"},
		DefaultColumns: []string{"FormattedID", "Name", "TargetDate", "TargetProject"},
		HasFormattedID: true,
	},
	{
		Name: "user", Display: "User",
		Aliases:        []string{"user", "users"},
		DefaultColumns: []string{"UserName", "DisplayName", "EmailAddress", "Disabled"},
	},
	{
		Name: "project", Display: "Project",
		Aliases:        []string{"project", "projects"},
		DefaultColumns: []string{"Name", "State", "Owner", "Parent"},
	},
	{
		Name: "typedefinition", Display: "Type Definition",
		Aliases:        []string{"typedefinition", "typedefinitions", "type", "types"},
		DefaultColumns: []string{"ElementName", "TypePath", "Name", "Parent"},
	},
}

// GenericColumns are the fallback for types not in the registry.
var GenericColumns = []string{"FormattedID", "Name", "ObjectID"}

// ResolveType maps a user-supplied type name or alias to a TypeInfo.
// Unknown names pass through as-is (WSAPI has ~60 types; the registry only
// curates defaults for common ones).
func ResolveType(name string) TypeInfo {
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, t := range Registry {
		if t.Name == lower {
			return t
		}
		for _, a := range t.Aliases {
			if a == lower {
				return t
			}
		}
	}
	return TypeInfo{Name: lower, Display: name, DefaultColumns: GenericColumns, HasFormattedID: true}
}

// DefaultOrder gives every query a deterministic default ordering.
func (t TypeInfo) DefaultOrder() string {
	if t.HasFormattedID {
		return "FormattedID ASC"
	}
	return "ObjectID ASC"
}

var formattedIDRe = regexp.MustCompile(`^([A-Za-z]+)(\d+)$`)

// ParseFormattedID splits "US123" into prefix "US" and full ID "US123".
func ParseFormattedID(s string) (prefix string, ok bool) {
	m := formattedIDRe.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return "", false
	}
	return strings.ToUpper(m[1]), true
}

// TypeForPrefix maps a FormattedID prefix (US, DE, ...) to its type.
func TypeForPrefix(prefix string) (TypeInfo, bool) {
	for _, t := range Registry {
		for _, p := range t.Prefixes {
			if p == prefix {
				return t, true
			}
		}
	}
	return TypeInfo{}, false
}

var typeOIDRe = regexp.MustCompile(`^([a-z][a-z/]*)/(\d+)$`)

// ParseTypeOID splits "defect/4321987654" into ("defect", "4321987654").
func ParseTypeOID(s string) (typ, oid string, ok bool) {
	m := typeOIDRe.FindStringSubmatch(strings.ToLower(strings.TrimSpace(s)))
	if m == nil {
		return "", "", false
	}
	// portfolioitem/feature/123 → type portfolioitem/feature, oid 123
	if idx := strings.LastIndex(m[0], "/"); idx > 0 {
		return m[0][:idx], m[0][idx+1:], true
	}
	return m[1], m[2], true
}
