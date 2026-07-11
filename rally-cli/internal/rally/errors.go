package rally

import (
	"fmt"
	"strings"
)

// AuthError means Rally rejected our credentials (HTTP 401/403) or none were provided.
type AuthError struct {
	HTTPStatus int
	Message    string
}

func (e *AuthError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("authentication failed (HTTP %d)", e.HTTPStatus)
}

// NotFoundError means the requested object or endpoint does not exist.
type NotFoundError struct {
	What string
}

func (e *NotFoundError) Error() string {
	if e.What != "" {
		return e.What + " not found"
	}
	return "not found"
}

// APIError carries errors reported by Rally in a QueryResult/OperationResult
// Errors[] array. Rally frequently returns these with HTTP 200.
type APIError struct {
	HTTPStatus int
	Messages   []string
}

func (e *APIError) Error() string {
	if len(e.Messages) == 0 {
		return fmt.Sprintf("Rally API error (HTTP %d)", e.HTTPStatus)
	}
	return "Rally API error: " + strings.Join(e.Messages, "; ")
}

// NetworkError wraps transport-level failures (after retries were exhausted).
type NetworkError struct {
	Err error
}

func (e *NetworkError) Error() string { return "network error: " + e.Err.Error() }
func (e *NetworkError) Unwrap() error { return e.Err }
