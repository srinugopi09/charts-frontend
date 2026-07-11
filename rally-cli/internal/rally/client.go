package rally

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// DefaultBaseURL is Rally's SaaS WSAPI v2.0 endpoint.
const DefaultBaseURL = "https://rally1.rallydev.com/slm/webservice/v2.0/"

// Client is a minimal Rally WSAPI v2.0 client. It is read-only in v1, but
// Do() carries method+body so Create/Update/Delete are additive later.
// The client never prints and never calls os.Exit; it returns typed errors
// (*AuthError, *NotFoundError, *APIError, *NetworkError) for the CLI to map.
type Client struct {
	BaseURL    *url.URL
	APIKey     string
	Username   string // Basic-auth fallback when APIKey is empty
	Password   string
	HTTP       *http.Client
	UserAgent  string
	MaxRetries int                              // extra attempts after the first (default 3)
	Sleep      func(time.Duration)              // injectable for tests; nil = time.Sleep
	Logf       func(format string, args ...any) // verbose request logging; nil = off
}

// New builds a client for the given base URL (DefaultBaseURL when empty).
func New(baseURL, apiKey, username, password string, timeout time.Duration) (*Client, error) {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, fmt.Errorf("invalid base URL %q", baseURL)
	}
	return &Client{
		BaseURL:    u,
		APIKey:     apiKey,
		Username:   username,
		Password:   password,
		HTTP:       &http.Client{Timeout: timeout},
		UserAgent:  "rally-cli (+https://github.com/srinugopi09/rally-cli)",
		MaxRetries: 3,
	}, nil
}

// QueryParams are the WSAPI query-string knobs shared by all query requests.
type QueryParams struct {
	Query     string
	Fetch     string
	Order     string
	Workspace string // full ref, e.g. /workspace/12345
	Project   string // full ref, e.g. /project/67890
	Start     int    // 1-based; 0 means WSAPI default (1)
	PageSize  int    // 0 means WSAPI default (20); server cap 2000
	ScopeUp   *bool  // nil = omit (respect Rally defaults)
	ScopeDown *bool
}

func (p QueryParams) values() url.Values {
	v := url.Values{}
	if p.Query != "" {
		v.Set("query", p.Query)
	}
	if p.Fetch != "" {
		v.Set("fetch", p.Fetch)
	}
	if p.Order != "" {
		v.Set("order", p.Order)
	}
	if p.Workspace != "" {
		v.Set("workspace", p.Workspace)
	}
	if p.Project != "" {
		v.Set("project", p.Project)
	}
	if p.Start > 0 {
		v.Set("start", strconv.Itoa(p.Start))
	}
	if p.PageSize > 0 {
		v.Set("pagesize", strconv.Itoa(min(p.PageSize, MaxPageSize)))
	}
	if p.ScopeUp != nil {
		v.Set("projectScopeUp", strconv.FormatBool(*p.ScopeUp))
	}
	if p.ScopeDown != nil {
		v.Set("projectScopeDown", strconv.FormatBool(*p.ScopeDown))
	}
	return v
}

// MaxPageSize is the WSAPI server-side pagesize cap.
const MaxPageSize = 2000

// Query runs GET /{type} with the given params.
func (c *Client) Query(ctx context.Context, typ string, p QueryParams) (*QueryResult, error) {
	raw, status, err := c.do(ctx, http.MethodGet, typ, p.values(), nil)
	if err != nil {
		return nil, err
	}
	return parseQueryResult(raw, status)
}

// QueryURL runs a query against an absolute collection URL (a collection
// _ref like .../HierarchicalRequirement/123/Tasks).
func (c *Client) QueryURL(ctx context.Context, absURL string, p QueryParams) (*QueryResult, error) {
	raw, status, err := c.do(ctx, http.MethodGet, absURL, p.values(), nil)
	if err != nil {
		return nil, err
	}
	return parseQueryResult(raw, status)
}

// Get runs GET /{type}/{oid} and returns the bare object.
func (c *Client) Get(ctx context.Context, typ string, oid string, fetch string) (json.RawMessage, error) {
	v := url.Values{}
	if fetch != "" {
		v.Set("fetch", fetch)
	}
	raw, status, err := c.do(ctx, http.MethodGet, typ+"/"+oid, v, nil)
	if err != nil {
		return nil, err
	}
	_, obj, err := parseSingle(raw, status)
	return obj, err
}

// Do is the transport-level seam. v1 only issues GETs, but the signature
// carries method+body so write operations slot in without restructuring.
// (When writes arrive, the retry policy must gate on idempotent methods.)
func (c *Client) Do(ctx context.Context, method, path string, params url.Values, body io.Reader) (json.RawMessage, error) {
	raw, _, err := c.do(ctx, method, path, params, body)
	return raw, err
}

var retryableStatus = map[int]bool{429: true, 500: true, 502: true, 503: true, 504: true}

func (c *Client) do(ctx context.Context, method, path string, params url.Values, body io.Reader) (json.RawMessage, int, error) {
	var bodyBytes []byte
	if body != nil {
		b, err := io.ReadAll(body)
		if err != nil {
			return nil, 0, fmt.Errorf("reading request body: %w", err)
		}
		bodyBytes = b
	}

	u, err := c.resolveURL(path)
	if err != nil {
		return nil, 0, err
	}
	if params != nil && len(params) > 0 {
		u.RawQuery = params.Encode()
	}
	c.logf("%s %s", method, u.String())

	var lastErr error
	attempts := c.MaxRetries + 1
	for attempt := 0; attempt < attempts; attempt++ {
		if attempt > 0 {
			c.sleep(backoff(attempt))
		}
		var reqBody io.Reader
		if bodyBytes != nil {
			reqBody = strings.NewReader(string(bodyBytes))
		}
		req, err := http.NewRequestWithContext(ctx, method, u.String(), reqBody)
		if err != nil {
			return nil, 0, err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", c.UserAgent)
		if c.APIKey != "" {
			req.Header.Set("ZSESSIONID", c.APIKey)
		} else if c.Username != "" {
			req.SetBasicAuth(c.Username, c.Password)
		}

		resp, err := c.HTTP.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, 0, &NetworkError{Err: ctx.Err()}
			}
			lastErr = err
			c.logf("attempt %d failed: %v", attempt+1, err)
			continue
		}
		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		c.logf("HTTP %d (%d bytes)", resp.StatusCode, len(respBody))

		switch {
		case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
			return nil, resp.StatusCode, &AuthError{HTTPStatus: resp.StatusCode, Message: rallyErrorText(respBody)}
		case resp.StatusCode == http.StatusNotFound:
			return nil, resp.StatusCode, &NotFoundError{What: strings.TrimPrefix(path, "/")}
		case retryableStatus[resp.StatusCode]:
			lastErr = &APIError{HTTPStatus: resp.StatusCode, Messages: []string{rallyErrorText(respBody)}}
			if attempt < attempts-1 {
				if wait := retryAfter(resp.Header.Get("Retry-After")); wait > 0 {
					c.sleep(wait)
				}
				continue
			}
		case resp.StatusCode >= 400:
			messages := []string{rallyErrorText(respBody)}
			return nil, resp.StatusCode, &APIError{HTTPStatus: resp.StatusCode, Messages: messages}
		default:
			return respBody, resp.StatusCode, nil
		}
	}
	if apiErr, ok := lastErr.(*APIError); ok {
		return nil, apiErr.HTTPStatus, apiErr
	}
	return nil, 0, &NetworkError{Err: lastErr}
}

// resolveURL accepts a path relative to the base URL ("defect", "defect/123")
// or an absolute URL (collection _refs are absolute).
func (c *Client) resolveURL(path string) (*url.URL, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return url.Parse(path)
	}
	return c.BaseURL.Parse(strings.TrimPrefix(path, "/"))
}

// rallyErrorText pulls the first useful error string out of an error body.
func rallyErrorText(body []byte) string {
	var envelope map[string]struct {
		Errors []string `json:"Errors"`
	}
	if err := json.Unmarshal(body, &envelope); err == nil {
		for _, v := range envelope {
			if len(v.Errors) > 0 {
				return strings.Join(v.Errors, "; ")
			}
		}
	}
	s := strings.TrimSpace(string(body))
	if len(s) > 200 {
		s = s[:200]
	}
	return s
}

func backoff(attempt int) time.Duration {
	base := 500 * time.Millisecond << (attempt - 1) // 0.5s, 1s, 2s...
	jitter := time.Duration(rand.Int63n(int64(base)))
	return base + jitter
}

func retryAfter(header string) time.Duration {
	if header == "" {
		return 0
	}
	if secs, err := strconv.Atoi(header); err == nil && secs > 0 {
		return time.Duration(secs) * time.Second
	}
	return 0
}

func (c *Client) sleep(d time.Duration) {
	if c.Sleep != nil {
		c.Sleep(d)
		return
	}
	time.Sleep(d)
}

func (c *Client) logf(format string, args ...any) {
	if c.Logf != nil {
		c.Logf(format, args...)
	}
}
