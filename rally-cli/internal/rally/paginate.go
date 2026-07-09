package rally

import (
	"context"
	"encoding/json"
	"fmt"
)

// DefaultMaxRequests bounds --all so a stray query can't download a whole
// workspace by accident. 100 pages × pagesize 2000 = 200k objects.
const DefaultMaxRequests = 100

// QueryAll pages through a query until limit results are collected or the
// result set is exhausted. limit <= 0 means all results. Returns the
// collected objects and Rally's TotalResultCount.
func (c *Client) QueryAll(ctx context.Context, typ string, p QueryParams, limit, maxRequests int) ([]json.RawMessage, int, error) {
	if maxRequests <= 0 {
		maxRequests = DefaultMaxRequests
	}
	start := p.Start
	if start <= 0 {
		start = 1
	}

	var out []json.RawMessage
	total := 0
	for request := 0; ; request++ {
		if request >= maxRequests {
			return nil, 0, fmt.Errorf("aborted after %d requests (%d results): narrow the query, raise --max-requests, or use --limit", maxRequests, len(out))
		}
		page := p
		page.Start = start
		page.PageSize = pageSizeFor(limit, len(out), p.PageSize)

		qr, err := c.Query(ctx, typ, page)
		if err != nil {
			return nil, 0, err
		}
		total = qr.TotalResultCount
		out = append(out, qr.Results...)

		if limit > 0 && len(out) >= limit {
			return out[:limit], total, nil
		}
		start += len(qr.Results)
		if len(qr.Results) == 0 || start > total {
			return out, total, nil
		}
	}
}

// pageSizeFor picks the WSAPI pagesize for the next request: the flag value
// when set, otherwise just enough to reach limit, otherwise a big page for
// unbounded fetches — always within the server cap.
func pageSizeFor(limit, have, flagSize int) int {
	size := flagSize
	if size <= 0 {
		if limit > 0 {
			size = limit - have
		} else {
			size = 200
		}
	}
	if size < 1 {
		size = 1
	}
	return min(size, MaxPageSize)
}
