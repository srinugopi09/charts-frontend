package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

// rawDefect resembles a real WSAPI object: metadata noise, nested refs, a
// collection, a null.
const rawDefect = `{
  "_rallyAPIMajor": "2", "_rallyAPIMinor": "0",
  "_ref": "https://rally1.rallydev.com/slm/webservice/v2.0/defect/123",
  "_refObjectUUID": "aaaa-bbbb", "_objectVersion": "7", "_CreatedAt": "today",
  "_refObjectName": "Login fails", "_type": "Defect",
  "ObjectID": 123,
  "FormattedID": "DE45",
  "Name": "Login fails",
  "State": "Open",
  "CreationDate": "2026-07-01T12:34:56.789Z",
  "Owner": {"_rallyAPIMajor":"2","_ref":"https://x/user/9","_refObjectName":"Jane Doe","_type":"User"},
  "Iteration": null,
  "Tasks": {"_rallyAPIMajor":"2","_ref":"https://x/defect/123/Tasks","_type":"Task","Count":4}
}`

func TestCleanStripsMetadata(t *testing.T) {
	cleaned := Clean(json.RawMessage(rawDefect), false)
	for _, gone := range []string{"_rallyAPIMajor", "_ref", "_refObjectUUID", "_objectVersion", "_type", "_CreatedAt", "_refObjectName"} {
		if _, ok := cleaned[gone]; ok {
			t.Errorf("cleaned object still has %s", gone)
		}
	}
	if cleaned["Owner"] != "Jane Doe" {
		t.Errorf("Owner = %v, want collapsed display name", cleaned["Owner"])
	}
	tasks, ok := cleaned["Tasks"].(map[string]any)
	if !ok || tasks["count"] != float64(4) || len(tasks) != 1 {
		t.Errorf("Tasks = %v, want {count: 4}", cleaned["Tasks"])
	}
	if cleaned["FormattedID"] != "DE45" || cleaned["ObjectID"] != float64(123) {
		t.Errorf("data fields must survive: %v", cleaned)
	}
	if v, ok := cleaned["Iteration"]; !ok || v != nil {
		t.Errorf("null field should remain null, got %v", v)
	}
}

func TestCleanKeepRefs(t *testing.T) {
	cleaned := Clean(json.RawMessage(rawDefect), true)
	if _, ok := cleaned["_ref"]; !ok {
		t.Error("--refs should keep top-level _ref")
	}
	owner, ok := cleaned["Owner"].(map[string]any)
	if !ok || owner["name"] != "Jane Doe" || owner["_ref"] == nil {
		t.Errorf("Owner with refs = %v", cleaned["Owner"])
	}
}

func TestWriteJSONResultsEnvelope(t *testing.T) {
	var buf bytes.Buffer
	err := WriteJSONResults(&buf, []json.RawMessage{json.RawMessage(rawDefect)}, 57, 1, nil, Options{Format: FormatJSON})
	if err != nil {
		t.Fatal(err)
	}
	var envelope map[string]any
	if err := json.Unmarshal(buf.Bytes(), &envelope); err != nil {
		t.Fatalf("output is not JSON: %v\n%s", err, buf.String())
	}
	if envelope["count"] != float64(1) || envelope["total"] != float64(57) {
		t.Errorf("count/total = %v/%v", envelope["count"], envelope["total"])
	}
	if _, ok := envelope["startIndex"]; ok {
		t.Error("startIndex should be omitted when 1")
	}
	if _, ok := envelope["warnings"]; ok {
		t.Error("empty warnings should be omitted")
	}
	if strings.Count(buf.String(), "\n") != 1 {
		t.Errorf("expected compact single-line JSON, got:\n%s", buf.String())
	}
}

func TestWriteJSONResultsRaw(t *testing.T) {
	var buf bytes.Buffer
	err := WriteJSONResults(&buf, []json.RawMessage{json.RawMessage(rawDefect)}, 1, 1, nil, Options{Format: FormatJSON, Raw: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(buf.String(), "_rallyAPIMajor") {
		t.Error("--raw should keep Rally metadata verbatim")
	}
}

func TestWriteTable(t *testing.T) {
	var buf bytes.Buffer
	longName := `{"FormattedID":"DE1","Name":"` + strings.Repeat("x", 80) + `","State":null,"Owner":{"_refObjectName":"Jane Doe"},"CreationDate":"2026-07-01T12:34:56.789Z"}`
	err := WriteTable(&buf, []json.RawMessage{json.RawMessage(longName)},
		[]string{"FormattedID", "Name", "State", "Owner", "CreationDate"})
	if err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if !strings.Contains(out, "FORMATTEDID") {
		t.Errorf("missing header:\n%s", out)
	}
	if !strings.Contains(out, "…") {
		t.Errorf("long value should be truncated:\n%s", out)
	}
	if !strings.Contains(out, "—") {
		t.Errorf("null should render as em-dash:\n%s", out)
	}
	if !strings.Contains(out, "Jane Doe") {
		t.Errorf("nested ref should render display name:\n%s", out)
	}
	if !strings.Contains(out, "2026-07-01") || strings.Contains(out, "12:34") {
		t.Errorf("date should be trimmed to day:\n%s", out)
	}
}

func TestWriteCSV(t *testing.T) {
	var buf bytes.Buffer
	rows := []json.RawMessage{
		json.RawMessage(`{"FormattedID":"DE1","Name":"has, comma","Owner":{"_refObjectName":"Jane"}}`),
		json.RawMessage(`{"FormattedID":"DE2","Name":"plain","Owner":null}`),
	}
	if err := WriteCSV(&buf, rows, []string{"FormattedID", "Name", "Owner"}); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 3 {
		t.Fatalf("want header+2 rows, got:\n%s", buf.String())
	}
	if lines[0] != "FormattedID,Name,Owner" {
		t.Errorf("header = %q", lines[0])
	}
	if !strings.Contains(lines[1], `"has, comma"`) {
		t.Errorf("comma value should be quoted: %q", lines[1])
	}
	if lines[2] != "DE2,plain," {
		t.Errorf("null should be empty in CSV: %q", lines[2])
	}
}

func TestWriteErrorJSON(t *testing.T) {
	var buf bytes.Buffer
	WriteErrorJSON(&buf, ErrorJSON{Code: "auth_failed", ExitCode: 3, Message: "no key", HTTPStatus: 401})
	var parsed struct {
		Error struct {
			Code     string `json:"code"`
			ExitCode int    `json:"exitCode"`
		} `json:"error"`
	}
	if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
		t.Fatalf("bad error JSON: %v\n%s", err, buf.String())
	}
	if parsed.Error.Code != "auth_failed" || parsed.Error.ExitCode != 3 {
		t.Errorf("parsed = %+v", parsed)
	}
}

func TestDetect(t *testing.T) {
	if f, err := Detect("json"); err != nil || f != FormatJSON {
		t.Errorf("Detect(json) = %v, %v", f, err)
	}
	if _, err := Detect("yaml"); err == nil {
		t.Error("Detect(yaml) should error")
	}
	// stdout is not a TTY under `go test`
	if f, err := Detect(""); err != nil || f != FormatJSON {
		t.Errorf("Detect(auto, piped) = %v, %v — want json", f, err)
	}
}
