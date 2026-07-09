package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// run executes the command tree in-process and returns stdout, stderr, and
// the mapped exit code — the same path main() takes.
func run(t *testing.T, args ...string) (string, string, int) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", t.TempDir()) // isolate config file
	for _, env := range []string{"RALLY_API_KEY", "RALLY_BASE_URL", "RALLY_WORKSPACE", "RALLY_PROJECT", "RALLY_USERNAME", "RALLY_PASSWORD"} {
		t.Setenv(env, "")
	}
	var stdout, stderr bytes.Buffer
	a := &app{version: "test", commit: "abc", stdout: &stdout, stderr: &stderr}
	root := a.rootCmd()
	root.SetArgs(args)
	code := ExitOK
	if err := root.Execute(); err != nil {
		ee := classify(err)
		a.printError(ee)
		code = ee.Code
	}
	return stdout.String(), stderr.String(), code
}

func testServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv
}

const defectPage = `{"QueryResult":{"TotalResultCount":42,"StartIndex":1,"PageSize":20,"Results":[
  {"_ref":"https://x/defect/1","_type":"Defect","_rallyAPIMajor":"2","FormattedID":"DE1","Name":"Broken login","State":"Open",
   "Owner":{"_ref":"https://x/user/9","_refObjectName":"Jane Doe"}}
],"Errors":[],"Warnings":[]}}`

func TestQueryJSONEnvelope(t *testing.T) {
	var gotOrder, gotFetch string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotOrder = r.URL.Query().Get("order")
		gotFetch = r.URL.Query().Get("fetch")
		fmt.Fprint(w, defectPage)
	})
	stdout, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "-o", "json", "-n", "1")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if gotOrder != "FormattedID ASC" {
		t.Errorf("default order = %q", gotOrder)
	}
	if !strings.Contains(gotFetch, "FormattedID") || !strings.Contains(gotFetch, "Severity") {
		t.Errorf("default fetch should be defect columns, got %q", gotFetch)
	}
	var envelope struct {
		Results []map[string]any `json:"results"`
		Count   int              `json:"count"`
		Total   int              `json:"total"`
	}
	if err := json.Unmarshal([]byte(stdout), &envelope); err != nil {
		t.Fatalf("stdout not JSON: %v\n%s", err, stdout)
	}
	if envelope.Count != 1 || envelope.Total != 42 {
		t.Errorf("count/total = %d/%d", envelope.Count, envelope.Total)
	}
	if envelope.Results[0]["Owner"] != "Jane Doe" {
		t.Errorf("Owner should be collapsed: %v", envelope.Results[0])
	}
	if _, ok := envelope.Results[0]["_ref"]; ok {
		t.Error("_ref should be stripped by default")
	}
}

func TestQueryFilterCompilation(t *testing.T) {
	var gotQuery string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query().Get("query")
		fmt.Fprint(w, defectPage)
	})
	_, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL,
		"-f", "State != Closed", "-f", "Severity = Critical")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	want := `((State != "Closed") AND (Severity = "Critical"))`
	if gotQuery != want {
		t.Errorf("compiled query = %q, want %q", gotQuery, want)
	}
}

func TestQueryAndFilterMutuallyExclusive(t *testing.T) {
	_, stderr, code := run(t, "query", "defect", "--api-key", "k",
		"-q", `(State = "Open")`, "-f", "Severity = Critical")
	if code != ExitUsage {
		t.Fatalf("exit = %d, want %d (stderr: %s)", code, ExitUsage, stderr)
	}
}

func TestQueryCount(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":1234,"StartIndex":1,"PageSize":1,"Results":[{}],"Errors":[],"Warnings":[]}}`)
	})
	stdout, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "--count")
	if code != ExitOK || strings.TrimSpace(stdout) != "1234" {
		t.Errorf("count output = %q (exit %d)", stdout, code)
	}
}

func TestAliasSharesQueryPath(t *testing.T) {
	var gotType, gotQuery string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotType = r.URL.Path
		gotQuery = r.URL.Query().Get("query")
		fmt.Fprint(w, defectPage)
	})
	_, _, code := run(t, "stories", "--api-key", "k", "--base-url", srv.URL, "--iteration", "Sprint 12")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if !strings.HasSuffix(gotType, "/hierarchicalrequirement") {
		t.Errorf("path = %q", gotType)
	}
	if gotQuery != `(Iteration.Name = "Sprint 12")` {
		t.Errorf("iteration sugar query = %q", gotQuery)
	}
}

func TestGetByFormattedID(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "hierarchicalrequirement") {
			t.Errorf("US prefix should query hierarchicalrequirement, got %s", r.URL.Path)
		}
		if q := r.URL.Query().Get("query"); q != `(FormattedID = "US123")` {
			t.Errorf("query = %q", q)
		}
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":1,"StartIndex":1,"PageSize":2,"Results":[{"_ref":"https://x/hierarchicalrequirement/7","FormattedID":"US123","Name":"Checkout flow","ScheduleState":"Defined"}],"Errors":[],"Warnings":[]}}`)
	})
	stdout, _, code := run(t, "get", "US123", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(stdout), &obj); err != nil {
		t.Fatalf("not a bare JSON object: %v\n%s", err, stdout)
	}
	if obj["FormattedID"] != "US123" {
		t.Errorf("obj = %v", obj)
	}
	if _, hasEnvelope := obj["results"]; hasEnvelope {
		t.Error("get must print a bare object, not an envelope")
	}
}

func TestGetByTypeOID(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/defect/4321" {
			t.Errorf("path = %q", r.URL.Path)
		}
		fmt.Fprint(w, `{"Defect":{"FormattedID":"DE9","Name":"x"}}`)
	})
	stdout, _, code := run(t, "get", "defect/4321", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK || !strings.Contains(stdout, "DE9") {
		t.Errorf("exit=%d stdout=%s", code, stdout)
	}
}

func TestGetAmbiguous(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":2,"StartIndex":1,"PageSize":2,"Results":[{"FormattedID":"US1"},{"FormattedID":"US1"}],"Errors":[],"Warnings":[]}}`)
	})
	_, stderr, code := run(t, "get", "US1", "--api-key", "k", "--base-url", srv.URL)
	if code != ExitNotFound {
		t.Fatalf("exit = %d, want %d", code, ExitNotFound)
	}
	if !strings.Contains(stderr, "ambiguous_id") {
		t.Errorf("stderr should carry ambiguous_id code: %s", stderr)
	}
}

func TestGetUnknownPrefixFallsBackToArtifact(t *testing.T) {
	var paths []string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":1,"StartIndex":1,"PageSize":2,"Results":[{"_type":"Defect","FormattedID":"ZZ7","Name":"custom prefix"}],"Errors":[],"Warnings":[]}}`)
	})
	stdout, _, code := run(t, "get", "ZZ7", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if len(paths) != 1 || !strings.HasSuffix(paths[0], "/artifact") {
		t.Errorf("expected single artifact query, got %v", paths)
	}
	if !strings.Contains(stdout, "ZZ7") {
		t.Errorf("stdout = %s", stdout)
	}
}

func TestAuthErrorMapsToExit3(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	_, stderr, code := run(t, "query", "defect", "--api-key", "bad", "--base-url", srv.URL)
	if code != ExitAuth {
		t.Fatalf("exit = %d, want %d", code, ExitAuth)
	}
	var parsed struct {
		Error struct {
			Code       string `json:"code"`
			ExitCode   int    `json:"exitCode"`
			HTTPStatus int    `json:"httpStatus"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(stderr), &parsed); err != nil {
		t.Fatalf("stderr not structured JSON: %v\n%s", err, stderr)
	}
	if parsed.Error.Code != "auth_failed" || parsed.Error.ExitCode != 3 || parsed.Error.HTTPStatus != 401 {
		t.Errorf("parsed = %+v", parsed)
	}
}

func TestMissingCredentials(t *testing.T) {
	_, stderr, code := run(t, "query", "defect")
	if code != ExitAuth {
		t.Fatalf("exit = %d, want %d (stderr: %s)", code, ExitAuth, stderr)
	}
	if !strings.Contains(stderr, "RALLY_API_KEY") {
		t.Errorf("error should point at the fix: %s", stderr)
	}
}

func TestRallyErrorsMapToExit5(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":0,"Results":[],"Errors":["Could not parse: unknown attribute \"Sate\""],"Warnings":[]}}`)
	})
	_, stderr, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "-q", "(Sate = x)")
	if code != ExitAPI {
		t.Fatalf("exit = %d, want %d", code, ExitAPI)
	}
	if !strings.Contains(stderr, "bad_query") {
		t.Errorf("stderr should classify as bad_query: %s", stderr)
	}
}

func TestUnknownCommandIsUsage(t *testing.T) {
	_, _, code := run(t, "frobnicate")
	if code != ExitUsage {
		t.Errorf("exit = %d, want %d", code, ExitUsage)
	}
}

func TestUnknownFlagIsUsage(t *testing.T) {
	_, _, code := run(t, "query", "defect", "--definitely-not-a-flag")
	if code != ExitUsage {
		t.Errorf("exit = %d, want %d", code, ExitUsage)
	}
}

func TestEmptyResultIsSuccess(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":0,"StartIndex":1,"PageSize":20,"Results":[],"Errors":[],"Warnings":[]}}`)
	})
	stdout, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK {
		t.Fatalf("empty result must exit 0, got %d", code)
	}
	if !strings.Contains(stdout, `"count":0`) {
		t.Errorf("stdout = %s", stdout)
	}
}

func TestCSVOutput(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, defectPage)
	})
	stdout, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "-o", "csv",
		"--fetch", "FormattedID,Name,Owner")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	lines := strings.Split(strings.TrimSpace(stdout), "\n")
	if lines[0] != "FormattedID,Name,Owner" {
		t.Errorf("csv header = %q", lines[0])
	}
	if !strings.Contains(lines[1], "Jane Doe") {
		t.Errorf("csv row = %q", lines[1])
	}
}

func TestTableOutput(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, defectPage)
	})
	stdout, stderr, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "-o", "table")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if !strings.Contains(stdout, "FORMATTEDID") || !strings.Contains(stdout, "DE1") {
		t.Errorf("table output:\n%s", stdout)
	}
	// the fixture serves the same 1-row page repeatedly, so pagination
	// collects up to the default limit of 20
	if !strings.Contains(stderr, "Showing 20 of 42 results") {
		t.Errorf("footer should go to stderr: %q", stderr)
	}
}

func TestGetCollection(t *testing.T) {
	var paths []string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if strings.HasSuffix(r.URL.Path, "/Tasks") {
			fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":1,"StartIndex":1,"PageSize":200,"Results":[{"FormattedID":"TA1","Name":"write tests","State":"Defined"}],"Errors":[],"Warnings":[]}}`)
			return
		}
		fmt.Fprintf(w, `{"QueryResult":{"TotalResultCount":1,"StartIndex":1,"PageSize":2,"Results":[{"FormattedID":"US1","Name":"story","Tasks":{"_ref":"%s/hierarchicalrequirement/7/Tasks","Count":1}}],"Errors":[],"Warnings":[]}}`, "http://"+r.Host)
	})
	stdout, _, code := run(t, "get", "US1", "--api-key", "k", "--base-url", srv.URL, "--collection", "Tasks", "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d (paths %v)", code, paths)
	}
	if !strings.Contains(stdout, "TA1") || !strings.Contains(stdout, `"results"`) {
		t.Errorf("collection output = %s", stdout)
	}
}

func TestWhoami(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/user" {
			t.Errorf("path = %q", r.URL.Path)
		}
		fmt.Fprint(w, `{"User":{"_ref":"https://x/user/1","UserName":"jane@example.com","DisplayName":"Jane Doe","EmailAddress":"jane@example.com","Disabled":false}}`)
	})
	stdout, _, code := run(t, "whoami", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if !strings.Contains(stdout, "jane@example.com") {
		t.Errorf("stdout = %s", stdout)
	}
}

func TestConfigRoundTrip(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	for _, env := range []string{"RALLY_API_KEY", "RALLY_BASE_URL", "RALLY_WORKSPACE", "RALLY_PROJECT"} {
		t.Setenv(env, "")
	}
	runNoIsolate := func(args ...string) (string, string, int) {
		var stdout, stderr bytes.Buffer
		a := &app{stdout: &stdout, stderr: &stderr}
		root := a.rootCmd()
		root.SetArgs(args)
		code := ExitOK
		if err := root.Execute(); err != nil {
			ee := classify(err)
			a.printError(ee)
			code = ee.Code
		}
		return stdout.String(), stderr.String(), code
	}
	if _, _, code := runNoIsolate("config", "set", "workspace", "12345"); code != ExitOK {
		t.Fatalf("set exit = %d", code)
	}
	stdout, _, code := runNoIsolate("config", "get", "workspace")
	if code != ExitOK || strings.TrimSpace(stdout) != "12345" {
		t.Errorf("get = %q (exit %d)", stdout, code)
	}
	stdout, _, _ = runNoIsolate("config", "list", "-o", "table")
	if !strings.Contains(stdout, "12345") {
		t.Errorf("list = %s", stdout)
	}
	if _, _, code := runNoIsolate("config", "unset", "workspace"); code != ExitOK {
		t.Fatalf("unset exit = %d", code)
	}
	stdout, _, _ = runNoIsolate("config", "get", "workspace")
	if strings.TrimSpace(stdout) != "" {
		t.Errorf("after unset, get = %q", stdout)
	}
	if _, _, code := runNoIsolate("config", "set", "not_a_key", "x"); code != ExitUsage {
		t.Errorf("bad key exit = %d", code)
	}
}

func TestConfigListMasksSecret(t *testing.T) {
	t.Setenv("RALLY_API_KEY", "_secretsecretsecret")
	var stdout, stderr bytes.Buffer
	a := &app{stdout: &stdout, stderr: &stderr}
	root := a.rootCmd()
	root.SetArgs([]string{"config", "list", "-o", "json"})
	if err := root.Execute(); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(stdout.String(), "secretsecret") {
		t.Errorf("api_key leaked in config list: %s", stdout.String())
	}
}

func TestWorkspaceScopingNormalized(t *testing.T) {
	var gotWorkspace string
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotWorkspace = r.URL.Query().Get("workspace")
		fmt.Fprint(w, defectPage)
	})
	_, _, code := run(t, "query", "defect", "--api-key", "k", "--base-url", srv.URL, "--workspace", "777")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if gotWorkspace != "/workspace/777" {
		t.Errorf("workspace param = %q", gotWorkspace)
	}
}

func TestWorkspaceNameRejected(t *testing.T) {
	_, stderr, code := run(t, "query", "defect", "--api-key", "k", "--workspace", "My Workspace")
	if code != ExitUsage {
		t.Errorf("exit = %d, want %d (stderr %s)", code, ExitUsage, stderr)
	}
}

func TestVersionJSON(t *testing.T) {
	stdout, _, code := run(t, "version", "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	var v struct {
		Version string `json:"version"`
		WSAPI   string `json:"wsapi"`
	}
	if err := json.Unmarshal([]byte(stdout), &v); err != nil || v.Version != "test" || v.WSAPI != "v2.0" {
		t.Errorf("version output = %s (err %v)", stdout, err)
	}
}

func TestSchemaAttributes(t *testing.T) {
	srv := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/typedefinition"):
			fmt.Fprintf(w, `{"QueryResult":{"TotalResultCount":1,"StartIndex":1,"PageSize":2,"Results":[{"ElementName":"Defect","Attributes":{"_ref":"%s/typedefinition/1/Attributes","Count":2}}],"Errors":[],"Warnings":[]}}`, "http://"+r.Host)
		case strings.HasSuffix(r.URL.Path, "/Attributes"):
			fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":2,"StartIndex":1,"PageSize":200,"Results":[
			  {"ElementName":"State","AttributeType":"RATING","Required":true,"ReadOnly":false,"Constrained":true,"Custom":false},
			  {"ElementName":"c_TeamKanban","AttributeType":"STRING","Required":false,"ReadOnly":false,"Constrained":false,"Custom":true}
			],"Errors":[],"Warnings":[]}}`)
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
	})
	stdout, _, code := run(t, "schema", "defect", "--api-key", "k", "--base-url", srv.URL, "-o", "json")
	if code != ExitOK {
		t.Fatalf("exit = %d", code)
	}
	if !strings.Contains(stdout, "c_TeamKanban") || !strings.Contains(stdout, `"State"`) {
		t.Errorf("schema output = %s", stdout)
	}
}
