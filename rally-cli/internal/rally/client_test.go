package rally

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func newTestClient(t *testing.T, handler http.HandlerFunc) (*Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	c, err := New(srv.URL+"/", "test-key", "", "", 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	c.Sleep = func(time.Duration) {} // no real backoff in tests
	return c, srv
}

func queryResultBody(total, start int, results ...string) string {
	joined := ""
	for i, r := range results {
		if i > 0 {
			joined += ","
		}
		joined += r
	}
	return fmt.Sprintf(`{"QueryResult":{"TotalResultCount":%d,"StartIndex":%d,"PageSize":%d,"Results":[%s],"Errors":[],"Warnings":[]}}`,
		total, start, len(results), joined)
}

func TestQuerySendsAuthAndParams(t *testing.T) {
	var gotHeader, gotQuery, gotFetch, gotPagesize string
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("ZSESSIONID")
		gotQuery = r.URL.Query().Get("query")
		gotFetch = r.URL.Query().Get("fetch")
		gotPagesize = r.URL.Query().Get("pagesize")
		fmt.Fprint(w, queryResultBody(1, 1, `{"FormattedID":"DE1"}`))
	})
	qr, err := c.Query(context.Background(), "defect", QueryParams{
		Query: `(State = "Open")`, Fetch: "FormattedID,Name", PageSize: 9999,
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotHeader != "test-key" {
		t.Errorf("ZSESSIONID = %q", gotHeader)
	}
	if gotQuery != `(State = "Open")` || gotFetch != "FormattedID,Name" {
		t.Errorf("params: query=%q fetch=%q", gotQuery, gotFetch)
	}
	if gotPagesize != strconv.Itoa(MaxPageSize) {
		t.Errorf("pagesize should be capped at %d, got %q", MaxPageSize, gotPagesize)
	}
	if qr.TotalResultCount != 1 || len(qr.Results) != 1 {
		t.Errorf("unexpected result: %+v", qr)
	}
}

func TestBasicAuthFallback(t *testing.T) {
	var user, pass string
	var ok bool
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok = r.BasicAuth()
		fmt.Fprint(w, queryResultBody(0, 1))
	})
	c.APIKey = ""
	c.Username, c.Password = "jane", "secret"
	if _, err := c.Query(context.Background(), "defect", QueryParams{}); err != nil {
		t.Fatal(err)
	}
	if !ok || user != "jane" || pass != "secret" {
		t.Errorf("basic auth = %q/%q/%v", user, pass, ok)
	}
}

func TestErrorsOnHTTP200(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":0,"Results":[],"Errors":["Could not parse: bad query"],"Warnings":[]}}`)
	})
	_, err := c.Query(context.Background(), "defect", QueryParams{})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("want *APIError, got %T: %v", err, err)
	}
}

func TestAuthError(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{"OperationResult":{"Errors":["Error 401: Invalid credentials"],"Warnings":[]}}`)
	})
	_, err := c.Query(context.Background(), "defect", QueryParams{})
	var authErr *AuthError
	if !errors.As(err, &authErr) {
		t.Fatalf("want *AuthError, got %T: %v", err, err)
	}
	if authErr.HTTPStatus != 401 {
		t.Errorf("status = %d", authErr.HTTPStatus)
	}
}

func TestNotFound(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	_, err := c.Get(context.Background(), "defect", "999", "true")
	var nf *NotFoundError
	if !errors.As(err, &nf) {
		t.Fatalf("want *NotFoundError, got %T: %v", err, err)
	}
}

func TestGetOperationResultNotFound(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"OperationResult":{"Errors":["Cannot find object to read"],"Warnings":[]}}`)
	})
	_, err := c.Get(context.Background(), "defect", "999", "true")
	var nf *NotFoundError
	if !errors.As(err, &nf) {
		t.Fatalf("want *NotFoundError, got %T: %v", err, err)
	}
}

func TestRetryOn429ThenSuccess(t *testing.T) {
	attempts := 0
	slept := 0
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		fmt.Fprint(w, queryResultBody(0, 1))
	})
	c.Sleep = func(time.Duration) { slept++ }
	if _, err := c.Query(context.Background(), "defect", QueryParams{}); err != nil {
		t.Fatal(err)
	}
	if attempts != 2 {
		t.Errorf("attempts = %d, want 2", attempts)
	}
	if slept == 0 {
		t.Error("expected backoff sleeps")
	}
}

func TestRetriesExhausted(t *testing.T) {
	attempts := 0
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	_, err := c.Query(context.Background(), "defect", QueryParams{})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("want *APIError after exhausted retries, got %T: %v", err, err)
	}
	if attempts != c.MaxRetries+1 {
		t.Errorf("attempts = %d, want %d", attempts, c.MaxRetries+1)
	}
}

func TestQueryAllPaginates(t *testing.T) {
	// 5 objects, pages of 2.
	objects := make([]string, 5)
	for i := range objects {
		objects[i] = fmt.Sprintf(`{"FormattedID":"DE%d"}`, i+1)
	}
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		start, _ := strconv.Atoi(r.URL.Query().Get("start"))
		if start == 0 {
			start = 1
		}
		end := min(start-1+2, len(objects))
		fmt.Fprint(w, queryResultBody(len(objects), start, objects[start-1:end]...))
	})
	results, total, err := c.QueryAll(context.Background(), "defect", QueryParams{PageSize: 2}, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if total != 5 || len(results) != 5 {
		t.Errorf("total=%d len=%d, want 5/5", total, len(results))
	}
	var last struct {
		FormattedID string
	}
	_ = json.Unmarshal(results[4], &last)
	if last.FormattedID != "DE5" {
		t.Errorf("last = %q", last.FormattedID)
	}
}

func TestQueryAllHonorsLimitMidPage(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, queryResultBody(100, 1, `{"n":1}`, `{"n":2}`, `{"n":3}`))
	})
	results, total, err := c.QueryAll(context.Background(), "defect", QueryParams{PageSize: 3}, 2, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 || total != 100 {
		t.Errorf("len=%d total=%d, want 2/100", len(results), total)
	}
}

func TestQueryAllMaxRequests(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		start, _ := strconv.Atoi(r.URL.Query().Get("start"))
		fmt.Fprint(w, queryResultBody(1000000, start, `{"n":1}`))
	})
	_, _, err := c.QueryAll(context.Background(), "defect", QueryParams{PageSize: 1}, 0, 3)
	if err == nil {
		t.Fatal("expected max-requests error")
	}
}

func TestQueryURLCollection(t *testing.T) {
	var path string
	c, srv := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		fmt.Fprint(w, queryResultBody(1, 1, `{"FormattedID":"TA1"}`))
	})
	qr, err := c.QueryURL(context.Background(), srv.URL+"/HierarchicalRequirement/123/Tasks", QueryParams{})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/HierarchicalRequirement/123/Tasks" {
		t.Errorf("path = %q", path)
	}
	if len(qr.Results) != 1 {
		t.Errorf("results = %d", len(qr.Results))
	}
}

func TestWarningsSurface(t *testing.T) {
	c, _ := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{"QueryResult":{"TotalResultCount":0,"Results":[],"Errors":[],"Warnings":["Please update your client"]}}`)
	})
	qr, err := c.Query(context.Background(), "defect", QueryParams{})
	if err != nil {
		t.Fatal(err)
	}
	if len(qr.Warnings) != 1 {
		t.Errorf("warnings = %v", qr.Warnings)
	}
}
