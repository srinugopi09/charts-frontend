package rally

import (
	"encoding/json"
	"fmt"
	"strings"
)

// QueryResult is the decoded form of Rally's {"QueryResult": {...}} envelope.
type QueryResult struct {
	TotalResultCount int               `json:"TotalResultCount"`
	StartIndex       int               `json:"StartIndex"`
	PageSize         int               `json:"PageSize"`
	Results          []json.RawMessage `json:"Results"`
	Errors           []string          `json:"Errors"`
	Warnings         []string          `json:"Warnings"`
}

// parseQueryResult decodes a query response and converts Rally's Errors[]
// (which arrive with HTTP 200) into an *APIError.
func parseQueryResult(raw json.RawMessage, httpStatus int) (*QueryResult, error) {
	var envelope struct {
		QueryResult *QueryResult `json:"QueryResult"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("decoding Rally response: %w", err)
	}
	if envelope.QueryResult == nil {
		// Not a query envelope; maybe an OperationResult carrying errors.
		if _, _, err := parseSingle(raw, httpStatus); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("unexpected Rally response: no QueryResult envelope")
	}
	qr := envelope.QueryResult
	if len(qr.Errors) > 0 {
		return nil, errorFromMessages(qr.Errors, httpStatus)
	}
	return qr, nil
}

// parseSingle decodes a single-object response ({"Defect": {...}}), returning
// the envelope key (the type name) and the raw object. An OperationResult
// envelope is converted to an error.
func parseSingle(raw json.RawMessage, httpStatus int) (string, json.RawMessage, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return "", nil, fmt.Errorf("decoding Rally response: %w", err)
	}
	if op, ok := envelope["OperationResult"]; ok {
		var result struct {
			Errors   []string `json:"Errors"`
			Warnings []string `json:"Warnings"`
		}
		if err := json.Unmarshal(op, &result); err != nil {
			return "", nil, fmt.Errorf("decoding Rally OperationResult: %w", err)
		}
		if len(result.Errors) > 0 {
			return "", nil, errorFromMessages(result.Errors, httpStatus)
		}
		return "OperationResult", op, nil
	}
	for key, obj := range envelope {
		if key == "QueryResult" {
			return "", nil, fmt.Errorf("unexpected query envelope in single-object response")
		}
		return key, obj, nil
	}
	return "", nil, fmt.Errorf("unexpected empty Rally response")
}

// SingleObject decodes a single-object envelope ({"User": {...}}) from a
// raw response body and returns the bare object.
func SingleObject(raw json.RawMessage) (json.RawMessage, error) {
	_, obj, err := parseSingle(raw, 200)
	return obj, err
}

// errorFromMessages classifies Rally error strings into typed errors.
func errorFromMessages(messages []string, httpStatus int) error {
	joined := strings.ToLower(strings.Join(messages, " "))
	switch {
	case strings.Contains(joined, "cannot find object"),
		strings.Contains(joined, "not found"),
		strings.Contains(joined, "unknown object type"),
		strings.Contains(joined, "could not read"):
		return &NotFoundError{What: strings.Join(messages, "; ")}
	case strings.Contains(joined, "not authorized"),
		strings.Contains(joined, "invalid key"),
		strings.Contains(joined, "credentials"):
		return &AuthError{HTTPStatus: httpStatus, Message: strings.Join(messages, "; ")}
	default:
		return &APIError{HTTPStatus: httpStatus, Messages: messages}
	}
}
