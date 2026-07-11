package cli

import (
	"context"
	"errors"
	"strings"

	"github.com/srinugopi09/rally-cli/internal/rally"
)

// Stable exit codes — part of the CLI's contract with agents.
const (
	ExitOK       = 0 // success (an empty result set is success)
	ExitGeneric  = 1 // unexpected/internal error
	ExitUsage    = 2 // bad flags/args, filter parse errors
	ExitAuth     = 3 // 401/403, missing credentials
	ExitNotFound = 4 // object/type not found, ambiguous FormattedID
	ExitAPI      = 5 // Rally API error (Errors[], bad server-side query)
	ExitNetwork  = 6 // timeout, DNS, connection failure (after retries)
)

// ExitError pairs an error with its exit code and stable machine code.
type ExitError struct {
	Code       int
	ErrCode    string // stable: usage, auth_failed, not_found, ambiguous_id, rally_error, bad_query, network, timeout, internal
	Message    string
	Details    []string
	HTTPStatus int
}

func (e *ExitError) Error() string { return e.Message }

func usageError(message string) *ExitError {
	return &ExitError{Code: ExitUsage, ErrCode: "usage", Message: message}
}

// classify maps any error to an ExitError with a stable code.
func classify(err error) *ExitError {
	var exitErr *ExitError
	if errors.As(err, &exitErr) {
		return exitErr
	}
	var authErr *rally.AuthError
	if errors.As(err, &authErr) {
		return &ExitError{
			Code: ExitAuth, ErrCode: "auth_failed", HTTPStatus: authErr.HTTPStatus,
			Message: "Rally rejected the request: " + authErr.Error() +
				". Set a key with: rally config set api_key <key>, or export RALLY_API_KEY.",
		}
	}
	var notFound *rally.NotFoundError
	if errors.As(err, &notFound) {
		return &ExitError{
			Code: ExitNotFound, ErrCode: "not_found",
			Message: notFound.Error() + ". FormattedIDs are workspace-scoped — check --workspace / rally config get workspace.",
		}
	}
	var apiErr *rally.APIError
	if errors.As(err, &apiErr) {
		code := "rally_error"
		if strings.Contains(strings.ToLower(apiErr.Error()), "could not parse") {
			code = "bad_query"
		}
		return &ExitError{
			Code: ExitAPI, ErrCode: code, HTTPStatus: apiErr.HTTPStatus,
			Message: apiErr.Error(), Details: apiErr.Messages,
		}
	}
	var netErr *rally.NetworkError
	if errors.As(err, &netErr) || errors.Is(err, context.DeadlineExceeded) {
		code := "network"
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "deadline") ||
			strings.Contains(err.Error(), "Timeout") || strings.Contains(err.Error(), "timeout") {
			code = "timeout"
		}
		return &ExitError{Code: ExitNetwork, ErrCode: code,
			Message: err.Error() + ". Check connectivity and --base-url; retries were already attempted."}
	}
	if strings.HasPrefix(err.Error(), "unknown command") || strings.HasPrefix(err.Error(), "unknown flag") ||
		strings.HasPrefix(err.Error(), "unknown shorthand flag") {
		return usageError(err.Error())
	}
	return &ExitError{Code: ExitGeneric, ErrCode: "internal", Message: err.Error()}
}
