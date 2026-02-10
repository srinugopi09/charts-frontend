# Tech Debt

## Console Log Cleanup

**Priority:** Medium
**Files:** `ag-ui.service.ts`, `a2ui-event.service.ts`, `graph.component.ts`

~25 `console.log` calls across core services and components flood the browser console on every query. They leak internal state (event payloads, surface IDs, action context) to anyone who opens DevTools.

**Action:** Remove debug-level `console.log` calls. Keep `console.error` and `console.warn`. Optionally downgrade a few genuinely useful diagnostics (surface creation, A2UI processing) to `console.debug` so they're hidden by default but available when needed.

## DataTable `rows` Getter Runs on Every Change Detection

**Priority:** Low
**File:** `data-table.component.ts`

The `rows` getter (which converts positional arrays to keyed objects) is called directly in the template for `rows.length` checks. This runs on every CD cycle. For typical table sizes (10-100 rows) the cost is negligible, but for large datasets consider memoizing with a `computed()` signal.

**Action:** Wrap `rows` in a `computed()` signal so the array-to-object conversion is cached.
