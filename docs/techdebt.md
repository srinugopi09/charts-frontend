# Tech Debt

## Console Log Cleanup

**Priority:** Medium
**Files:** `ag-ui.service.ts`, `a2ui-event.service.ts`, `graph.component.ts`

~25 `console.log` calls across core services and components flood the browser console on every query. They leak internal state (event payloads, surface IDs, action context) to anyone who opens DevTools.

**Action:** Remove debug-level `console.log` calls. Keep `console.error` and `console.warn`. Optionally downgrade a few genuinely useful diagnostics (surface creation, A2UI processing) to `console.debug` so they're hidden by default but available when needed.

## Duplicate Dashboard Title

**Priority:** Low
**Files:** `composite-dashboard.component.ts`, `canvas-toolbar.component.ts`

The dashboard title appears twice: once in the canvas toolbar (read from `surface.componentTree.properties.title`) and once as the `<h2>` inside `CompositeDashboard`. Remove the `<h2>` from CompositeDashboard since the toolbar already shows the title.
