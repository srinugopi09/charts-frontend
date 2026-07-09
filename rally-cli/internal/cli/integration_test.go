//go:build integration

package cli

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

// Integration tests hit real Rally. They run only with:
//
//	RALLY_API_KEY=<key> go test -tags integration ./internal/cli -run Integration
//
// They are intentionally excluded from CI and the default `go test ./...`.
func runIntegration(t *testing.T, args ...string) (string, string, int) {
	t.Helper()
	if os.Getenv("RALLY_API_KEY") == "" {
		t.Skip("RALLY_API_KEY not set")
	}
	var stdout, stderr bytes.Buffer
	a := &app{version: "integration", commit: "test", stdout: &stdout, stderr: &stderr}
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

func TestIntegrationWhoami(t *testing.T) {
	stdout, stderr, code := runIntegration(t, "whoami", "-o", "json")
	if code != ExitOK {
		t.Fatalf("whoami exit %d\nstdout: %s\nstderr: %s", code, stdout, stderr)
	}
	if !strings.Contains(stdout, "UserName") {
		t.Errorf("whoami output: %s", stdout)
	}
}

func TestIntegrationQueryDefect(t *testing.T) {
	stdout, stderr, code := runIntegration(t, "query", "defect", "-n", "1", "-o", "json")
	if code != ExitOK {
		t.Fatalf("query exit %d\nstdout: %s\nstderr: %s", code, stdout, stderr)
	}
	if !strings.Contains(stdout, `"total"`) {
		t.Errorf("query output: %s", stdout)
	}
}

func TestIntegrationSchemaDefect(t *testing.T) {
	stdout, stderr, code := runIntegration(t, "schema", "defect", "-o", "json")
	if code != ExitOK {
		t.Fatalf("schema exit %d\nstdout: %s\nstderr: %s", code, stdout, stderr)
	}
	if !strings.Contains(stdout, "ElementName") {
		t.Errorf("schema output: %s", stdout)
	}
}
