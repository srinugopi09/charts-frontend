# Agentic Analytics Chatbot — Frontend

## Project Overview

Conversational analytics app: users ask natural-language questions about data, receive text + interactive visualizations. Split-view layout with chat panel + visualization canvas.

## Tech Stack

- **Framework:** Angular 17+ (standalone components, signals — NO NgRx)
- **Agent Protocol:** @ag-ui/client + @ag-ui/core (HttpAgent, SSE events)
- **UI Rendering:** @a2ui/angular (dynamic component catalog)
- **Charts:** Chart.js 4.x via canvas (NOT ECharts)
- **Styling:** Tailwind CSS (NO Angular Material, NO PrimeNG)
- **Markdown:** ngx-markdown
- **Utilities:** @angular/cdk (virtual scroll, overlay — NOT drag/drop, we use native pointer events)
- **E2E Testing:** Playwright (real backend + Gemini, no mocks)

## Architecture

- **State:** Signal-based services (ChatStateService, SharedStateService, AgUiService, A2UIEventService, ChartAdapterService)
- **Layout:** Responsive split-view — single ng-content per slot, CSS media queries for breakpoints
  - Desktop (>=1024px): side-by-side with draggable divider (native pointer events)
  - Tablet (768px-1023px): tab switching
  - Mobile (<768px): external toggle button
- **A2UI Catalog:** Graph, KPICard, DataTable, RAGIndicator, InsightCard, CompositeDashboard
- **Backend:** FastAPI at localhost:8080

## Key Patterns

### A2UI DynamicComponent Property Access (CRITICAL)

All A2UI catalog components extend `DynamicComponent`. Properties are NOT class properties — they must be accessed via `this.component().properties`:

```typescript
export class MyComponent extends DynamicComponent {
  private getProp<T>(key: string, defaultValue?: T): T | undefined {
    const props: any = this.component().properties;
    return props[key] !== undefined ? props[key] : defaultValue;
  }

  get title(): string | undefined {
    return this.getProp<string>('title');
  }
}
```

### A2UI Action Format

Actions use `name` + `context` array (NOT `actionType` flat object):

```typescript
this.sendAction({
  name: 'drill_down',
  context: [
    { key: 'label', value: { literalString: 'North America' } },
    { key: 'value', value: { literalNumber: 44470000 } },
  ],
} as any);
```

### AG-UI Event Flow

- AG-UI events drive state updates (TEXT_MESSAGE_*, TOOL_CALL_*, STATE_DELTA, CUSTOM, RUN_*)
- A2UI visualization payloads arrive via TOOL_CALL_RESULT (primary) or CUSTOM events
- Chart JSON filtering: backend may send chart config as a TEXT_MESSAGE — detected and removed in TEXT_MESSAGE_END handler
- Stale reference warning: `currentStreamingMessage()` holds original object; look up actual message from `messages()` array by ID

### Responsive Layout (ng-content)

Angular `ng-content` can only project content ONCE per selector. Never duplicate ng-content in separate template branches. Use a single DOM layout with CSS media queries + data-attributes for responsive show/hide.

### Tailwind Animations

Never combine `opacity-0` utility class with CSS animations that set opacity. The utility class permanently overrides animation keyframes. Use animation classes alone.

### Chart.js Memory Management

Always call `chart.destroy()` before creating a new Chart instance. Implement in `ngOnDestroy()`.

### Divider Drag

Use native `pointerdown`/`pointermove`/`pointerup` events — NOT CDK Drag (which applies `transform: translate3d()` artifacts).

## Feature Flags

Centralized in `src/app/core/config/feature-flags.ts`. Flip a boolean to toggle a feature globally.

| Flag                  | Default | Description                                                              |
|-----------------------|---------|--------------------------------------------------------------------------|
| `DRILL_DOWN_ENABLED`  | `false` | Chart/KPI/table clicks trigger drill-down follow-up queries to the agent |
| `MODERN_CHART_STYLE`  | `true`  | Bar charts use modern styling (gradients, rounded corners, compact axes) |

Guards:

- `A2UIEventService` constructor — early-returns from the MessageProcessor event subscription (DRILL_DOWN)
- `GraphComponent.interactive` getter — returns `false` to suppress Chart.js click handler (DRILL_DOWN)
- `GraphComponent.isModernBar` / `buildModernBarConfig()` — switches bar chart config (MODERN_CHART_STYLE)

## Important Conventions

- No authentication (internal tool behind VPN)
- Custom Tailwind components only — no component libraries
- Colorblind-safe chart palettes
- Structural E2E assertions (not exact content matching — LLM responses vary)
- Message history capped at 50 messages sent to agent
- Chart.js canvases must be destroyed and recreated (memory leak prevention)
- KPI values: handle currency prefix symbols ($, £, €) in formattedValue to avoid double display

## Project Structure

See `frontend-blueprint.md` for full specification.

## Commands

- `ng serve` — dev server on localhost:4200
- `ng build` — production build
- `npx playwright test` — E2E tests (requires backend running)
- `ng test` — unit tests
