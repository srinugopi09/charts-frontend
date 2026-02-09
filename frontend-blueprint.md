# Frontend Blueprint — Agentic Analytics Chatbot

## Angular 17+ | AG-UI | A2UI | Chart.js | Tailwind CSS

---

## 1. Product Overview

A conversational analytics application where users ask natural language questions about their data and receive text insights paired with dynamically generated interactive visualizations. The app replaces dependency on centralized BI teams by letting an AI agent connect to data sources, analyze results, and present charts/graphs/tables directly in the chat interface.

### Target Users

- Engineering leaders reviewing portfolio metrics
- RTEs (Release Train Engineers) who currently spend hours manually collecting and curating data
- Anyone who today submits requests to a BI team and waits for dashboards

### MVP Scope

- Natural language questions with text + auto-visualized chart/graph answers
- Ad-hoc SQL queries with agent-chosen visualization
- Multi-turn conversational context with reliable drill-down via AG-UI shared state
- Interactive chart drill-downs (click chart elements to explore deeper)
- Full interactive visualization catalog (all chart types, tables, KPIs, dashboards)
- Responsive design (desktop, tablet, mobile)

### Out of Scope for MVP

- Rally integration (phase 2)
- Save/pin charts, export, share threads, persistent history
- Authentication (internal tool behind VPN)
- Editable chart filters/types inline (phase 2)

---

## 2. UI Layout & Responsive Design

### Layout: Split View

The app uses a split-view layout with a chat panel and a visualization canvas.

**Desktop (≥1024px):**

```
┌──────────────────────────────────────────────────────────┐
│  Header Bar (app title, connection status, settings)     │
├────────────────────────┬─────────────────────────────────┤
│                        │                                 │
│   Chat Panel           │   Visualization Canvas          │
│   (~40% width)         │   (~60% width)                  │
│                        │                                 │
│   - Message history    │   - Displays the LATEST         │
│   - Streaming text     │     visualization from the      │
│   - Inline mini-       │     conversation                │
│     previews of past   │   - Full-size interactive       │
│     charts (thumbnail) │     chart/dashboard             │
│   - Input bar at       │   - Updates when agent sends    │
│     bottom             │     new A2UI payload            │
│                        │   - Empty state: welcome        │
│                        │     message with example        │
│                        │     questions                   │
│                        │                                 │
├────────────────────────┴─────────────────────────────────┤
│  Input Bar (full width on mobile)                        │
│  [  Ask about your data...                    ] [Send]   │
└──────────────────────────────────────────────────────────┘
```

**Tablet (768px–1023px):**
- Tabbed layout: two tabs — "Chat" and "Canvas"
- When agent sends a new visualization, auto-switch to Canvas tab with a notification badge on Chat tab
- User can manually switch between tabs

**Mobile (<768px):**
- Single panel with a toggle button (chat icon / chart icon)
- Input bar always visible at bottom
- Charts render full-width in canvas mode

### Resizable Split (Desktop)

- The divider between chat and canvas is draggable (use Angular CDK drag)
- Minimum chat width: 320px
- Minimum canvas width: 400px
- Default split: 40/60
- User preference persisted in localStorage

---

## 3. Library Stack

| Library | Version Constraint | Purpose |
|---|---|---|
| `@angular/core` | 17+ (standalone components, signals) | Framework |
| `@ag-ui/client` | latest | AG-UI HttpAgent, event stream consumer, middleware |
| `@ag-ui/core` | latest | AG-UI typed events, message models, state schemas |
| `@a2ui/angular` | latest (v0.8+) | A2UI renderer, DynamicComponent base, catalog registration |
| `chart.js` | 4.x | Default chart rendering engine |
| `ngx-markdown` | latest compatible with Angular 17+ | Markdown rendering for agent text responses |
| `tailwindcss` | 3.x or 4.x | Utility-first styling |
| `@angular/cdk` | 17+ | Drag/drop (resizable splitter), virtual scroll, overlay, accessibility |
| `@playwright/test` | latest | E2E testing against real backend + Gemini |

### Libraries NOT to Use

- No `@angular/material` or `PrimeNG` — all components are custom with Tailwind
- No `NgRx` — state managed via Angular signals in services
- No `@copilotkitnext/angular` — we use headless `@ag-ui/client` directly
- No CopilotKit runtime — Angular talks directly to FastAPI backend

---

## 4. Application Architecture

### 4.1 Project Structure

```
e2e/
├── fixtures/
│   └── test-setup.ts                # Shared test config: base URL, timeouts, helpers
├── helpers/
│   ├── chat.helpers.ts               # Send message, wait for response, get messages
│   ├── canvas.helpers.ts             # Wait for chart, get chart title, click chart element
│   └── assertions.helpers.ts         # Custom assertions for A2UI, streaming, etc.
├── tests/
│   ├── chat-basics.spec.ts           # Send message, receive response, message list
│   ├── chart-rendering.spec.ts       # Agent returns chart → chart visible on canvas
│   ├── drill-down.spec.ts            # Click chart element → follow-up → new chart
│   ├── multi-turn.spec.ts            # Sequential questions with context preservation
│   ├── data-table.spec.ts            # Agent returns table → sort, filter, pagination
│   ├── kpi-dashboard.spec.ts         # Agent returns composite dashboard with KPIs
│   ├── tool-transparency.spec.ts     # Agent Activity section shows SQL, timing
│   ├── streaming-ux.spec.ts          # Typing indicator, token streaming, cancel
│   ├── canvas-states.spec.ts         # Empty state, loading, error, history dropdown
│   ├── responsive.spec.ts            # Desktop split, tablet tabs, mobile toggle
│   └── error-handling.spec.ts        # Backend down, invalid response, stream interrupt
├── playwright.config.ts              # Playwright configuration
└── global-setup.ts                   # Health check backend before running tests

src/
├── app/
│   ├── app.component.ts              # Root: layout shell (split view)
│   ├── app.config.ts                 # Providers: A2UI catalog, markdown config
│   ├── app.routes.ts                 # Routing (single route for MVP)
│   │
│   ├── core/                         # Singleton services, guards, interceptors
│   │   ├── services/
│   │   │   ├── ag-ui.service.ts      # AG-UI HttpAgent wrapper
│   │   │   ├── chat-state.service.ts # Signal-based conversation state
│   │   │   ├── shared-state.service.ts # AG-UI shared state management
│   │   │   ├── a2ui-event.service.ts # Bridges AG-UI custom events to A2UI renderer
│   │   │   └── chart-adapter.service.ts # Pluggable chart renderer resolution
│   │   └── models/
│   │       ├── chat.models.ts        # Message, ToolCall, ChatSession types
│   │       ├── shared-state.models.ts # AgentContext, ChartState, FilterState
│   │       └── a2ui.models.ts        # Custom node interfaces for catalog
│   │
│   ├── features/
│   │   ├── chat/                     # Chat panel feature
│   │   │   ├── chat-panel.component.ts
│   │   │   ├── message-list.component.ts
│   │   │   ├── message-bubble.component.ts
│   │   │   ├── input-bar.component.ts
│   │   │   ├── typing-indicator.component.ts
│   │   │   └── chart-thumbnail.component.ts  # Mini preview in chat
│   │   │
│   │   ├── canvas/                   # Visualization canvas feature
│   │   │   ├── canvas-panel.component.ts
│   │   │   ├── canvas-empty-state.component.ts
│   │   │   └── canvas-toolbar.component.ts   # Zoom, fullscreen, viz history
│   │   │
│   │   └── layout/                   # Shell layout components
│   │       ├── split-view.component.ts
│   │       ├── header-bar.component.ts
│   │       └── mobile-toggle.component.ts
│   │
│   ├── a2ui-catalog/                 # All A2UI custom components
│   │   ├── chart/
│   │   │   └── graph.component.ts            # Universal chart component
│   │   ├── kpi/
│   │   │   └── kpi-card.component.ts         # Single metric with trend
│   │   ├── table/
│   │   │   └── data-table.component.ts       # Sortable/filterable table
│   │   ├── status/
│   │   │   └── rag-indicator.component.ts    # Red/Amber/Green status
│   │   ├── text/
│   │   │   └── insight-card.component.ts     # Agent's insight in styled box
│   │   ├── dashboard/
│   │   │   └── composite-dashboard.component.ts  # Multi-chart + KPI container
│   │   └── catalog.config.ts         # Central catalog registration
│   │
│   └── shared/                       # Shared utilities, pipes, directives
│       ├── pipes/
│       │   └── relative-time.pipe.ts
│       ├── directives/
│       │   └── auto-scroll.directive.ts
│       └── components/
│           └── loading-skeleton.component.ts
│
├── styles/
│   ├── tailwind.css                  # Tailwind imports + custom utilities
│   └── a2ui-theme.css                # A2UI component theming overrides
│
└── environments/
    ├── environment.ts                # API URL, feature flags
    └── environment.prod.ts

e2e/                                  # Playwright E2E tests (project root level)
├── playwright.config.ts              # Playwright configuration
├── fixtures/
│   └── test-app.fixture.ts           # Shared fixture: launch app, wait for ready
├── pages/                            # Page Object Models
│   ├── chat-panel.page.ts            # Locators + actions for chat panel
│   ├── canvas-panel.page.ts          # Locators + actions for visualization canvas
│   └── app-shell.page.ts             # Layout, header, responsive toggle
├── tests/
│   ├── chat-flow.spec.ts             # Send message, receive response, streaming
│   ├── chart-rendering.spec.ts       # Verify charts render for different question types
│   ├── drill-down.spec.ts            # Click chart element, verify follow-up viz
│   ├── multi-turn.spec.ts            # Conversational context across multiple turns
│   ├── data-table.spec.ts            # Table rendering, sort, filter
│   ├── dashboard.spec.ts             # Composite dashboard rendering
│   ├── canvas-interactions.spec.ts   # Toolbar, fullscreen, viz history
│   ├── error-handling.spec.ts        # Backend errors, invalid responses
│   └── responsive.spec.ts            # Desktop, tablet, mobile layout assertions
└── helpers/
    ├── wait-helpers.ts               # Wait for streaming complete, chart rendered
    └── assertion-helpers.ts          # Structural assertions for charts, tables
```

### 4.2 Component Hierarchy

```
AppComponent (split-view shell)
├── HeaderBarComponent
│   ├── App title / logo
│   ├── Connection status indicator (connected / streaming / error)
│   └── Settings gear (future)
│
├── SplitViewComponent (resizable, responsive)
│   ├── ChatPanelComponent
│   │   ├── MessageListComponent
│   │   │   └── MessageBubbleComponent (repeated)
│   │   │       ├── ngx-markdown (for text content)
│   │   │       ├── ChartThumbnailComponent (clickable mini-preview)
│   │   │       └── TypingIndicatorComponent (when streaming)
│   │   └── InputBarComponent
│   │       ├── Textarea (auto-resize)
│   │       ├── Send button
│   │       └── Cancel button (visible during streaming)
│   │
│   └── CanvasPanelComponent
│       ├── CanvasToolbarComponent (zoom, fullscreen, viz history dropdown)
│       ├── A2UI Renderer (when visualization active)
│       │   └── [Dynamic A2UI catalog component]
│       └── CanvasEmptyStateComponent (when no visualization)
│
└── MobileToggleComponent (visible on mobile/tablet only)
```

---

## 5. Service Layer — Signal-Based State

### 5.1 ChatStateService

**Responsibility:** Manages the conversation messages, streaming status, and session identity.

**Signals:**

| Signal | Type | Description |
|---|---|---|
| `messages` | `Signal<ChatMessage[]>` | All messages in current conversation |
| `isStreaming` | `Signal<boolean>` | Whether agent is currently responding |
| `currentStreamingMessage` | `Signal<ChatMessage \| null>` | The message being streamed |
| `sessionId` | `Signal<string>` | Current conversation session ID |
| `error` | `Signal<string \| null>` | Last error message |

**Computed signals:**

| Signal | Derivation |
|---|---|
| `lastVisualization` | Latest message that contains an A2UI payload |
| `messageCount` | Length of messages array |
| `hasActiveConversation` | Whether any messages exist |

**ChatMessage model:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique message ID |
| `role` | `'user' \| 'assistant'` | Who sent it |
| `content` | `string` | Text content (markdown) |
| `timestamp` | `Date` | When sent/received |
| `isStreaming` | `boolean` | Whether still receiving tokens |
| `a2uiPayload` | `A2UISurface \| null` | If this message includes a visualization |
| `toolCalls` | `ToolCallInfo[] \| null` | Tool calls the agent made (for transparency) |

### 5.2 SharedStateService

**Responsibility:** Manages the AG-UI shared state — the structured context synced bi-directionally between Angular and the ADK agent. This is what enables reliable multi-turn drill-downs.

**AgentContext schema (the shared state object):**

| Field | Type | Description |
|---|---|---|
| `currentVisualization` | `VisualizationState \| null` | What's currently displayed on canvas |
| `lastQuery` | `QueryState \| null` | The last SQL query executed |
| `activeFilters` | `Record<string, any>` | Any filters the user has applied |
| `dataSource` | `string` | Which data source is active |
| `conversationIntent` | `string \| null` | Agent's understanding of the overall conversation goal |

**VisualizationState:**

| Field | Type | Description |
|---|---|---|
| `chartType` | `string` | What type of chart is displayed |
| `title` | `string` | Chart title |
| `a2uiNodeId` | `string` | Reference to the A2UI component rendered |
| `sourceQuery` | `string` | The SQL query that produced this data |
| `dataShape` | `{ rows: number, columns: string[] }` | Shape of the underlying data |
| `interactive` | `boolean` | Whether drill-down is enabled |

**QueryState:**

| Field | Type | Description |
|---|---|---|
| `sql` | `string` | The SQL that was executed |
| `database` | `string` | Which database |
| `rowCount` | `number` | How many rows returned |
| `executionTimeMs` | `number` | How long it took |
| `columns` | `string[]` | Column names in the result |

**How shared state flows:**

1. Agent executes a query and generates a chart → emits `STATE_DELTA` with updated `currentVisualization` and `lastQuery`
2. Angular's SharedStateService receives the delta via AG-UI event stream → updates local signals
3. User clicks a bar segment on the chart → Angular updates `activeFilters` in shared state
4. Next `runAgent()` call sends the full shared state → agent sees the filter context and knows exactly what to drill into
5. Agent responds with deeper data → emits new `STATE_DELTA` with updated visualization

### 5.3 AgUiService

**Responsibility:** Wraps `@ag-ui/client`'s `HttpAgent` and bridges AG-UI events to Angular signals.

**Configuration:**

| Setting | Value |
|---|---|
| Transport | HTTP (SSE) via `HttpAgent` |
| URL | `{environment.apiUrl}/api/agent/run` |
| Headers | None for MVP (no auth) |
| Middleware | Logging middleware (dev only), error handling middleware |

**Core behaviors:**

- On `runAgent()`: sends current `messages` array + current `sharedState` from SharedStateService
- On `TEXT_MESSAGE_START`: creates new streaming message in ChatStateService
- On `TEXT_MESSAGE_CONTENT`: appends delta text to current streaming message
- On `TEXT_MESSAGE_END`: finalizes message, marks streaming complete
- On `TOOL_CALL_START` / `TOOL_CALL_END`: updates tool call info on current message (for transparency)
- On `STATE_DELTA`: forwards JSON Patch to SharedStateService to update AgentContext
- On `CUSTOM` event with name `a2ui_surface_update`: extracts A2UI payload, attaches to current message, notifies A2UIEventService
- On `RUN_FINISHED`: marks streaming complete
- On `RUN_ERROR`: sets error in ChatStateService
- Cancel: calls `AbortController.abort()` to stop SSE stream

### 5.4 A2UIEventService

**Responsibility:** Bridges AG-UI custom events to the A2UI Angular renderer and handles fallback.

**Behaviors:**

- Receives A2UI surface payloads from AgUiService
- Validates the payload against known catalog component types
- If all component types in the payload exist in the A2UI catalog → routes to `@a2ui/angular` renderer
- If any component type is unknown → falls back to custom Angular component rendering (formatted JSON view)
- Emits signal `currentSurface` — observed by CanvasPanelComponent
- Emits signal `thumbnailSurface` — simplified version for chart mini-previews in chat

### 5.5 ChartAdapterService

**Responsibility:** Resolves which charting library renders a given chart type. Provides the pluggable abstraction over Chart.js.

**Default behavior (MVP):** All chart types → Chart.js

**Adapter interface (for future extensibility):**

| Method | Description |
|---|---|
| `getRenderer(chartType)` | Returns the rendering engine identifier for a chart type |
| `registerRenderer(chartType, renderer)` | Registers a custom renderer for a specific chart type |

**Future usage:** Register ECharts for treemap/heatmap while Chart.js handles everything else. The A2UI Graph component calls ChartAdapterService to determine which library to use, then delegates rendering.

---

## 6. A2UI Custom Catalog Design

The catalog defines every visual component the agent is allowed to generate. All components extend A2UI's `DynamicComponent` base class and are lazy-loaded.

### 6.1 Catalog Registration

All custom components registered in `a2ui-catalog/catalog.config.ts` and provided via `provideA2UI()` in `app.config.ts`. Each entry maps an A2UI type name to a lazy-loaded Angular component.

**Registered types:** `Graph`, `KPICard`, `DataTable`, `RAGIndicator`, `InsightCard`, `CompositeDashboard`

### 6.2 Component Specifications

---

#### Graph Component

**A2UI type:** `Graph`
**Purpose:** Universal chart renderer — handles all chart types via Chart.js.

**Properties the agent provides:**

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `graphType` | `'bar' \| 'line' \| 'pie' \| 'doughnut' \| 'area' \| 'radar' \| 'scatter' \| 'horizontalBar' \| 'stackedBar' \| 'stackedArea'` | Yes | — | Chart type |
| `title` | `string` | Yes | — | Chart title |
| `data` | `ChartData` | Yes | — | Labels + datasets |
| `xLabel` | `string` | No | — | X-axis label |
| `yLabel` | `string` | No | — | Y-axis label |
| `interactive` | `boolean` | No | `true` | Whether click triggers drill-down |
| `showLegend` | `boolean` | No | `true` | Show/hide legend |
| `colorScheme` | `string` | No | `"default"` | Named color palette |

**ChartData structure:**

| Field | Type |
|---|---|
| `labels` | `string[]` |
| `datasets` | `Array<{ label: string, data: number[], backgroundColor?: string \| string[], borderColor?: string }>` |

**Interactions:**
- Click on bar/segment/point → emits A2UI action `{ type: 'drill_down', label, value, datasetLabel }`
- Hover shows tooltip with value details
- Legend click toggles series visibility (local, no agent call)

---

#### KPICard Component

**A2UI type:** `KPICard`
**Purpose:** Single key metric display with optional trend indicator.

**Properties:**

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `label` | `string` | Yes | — | Metric name |
| `value` | `string \| number` | Yes | — | The metric value |
| `unit` | `string` | No | — | Unit label ("$", "%", "pts") |
| `trend` | `'up' \| 'down' \| 'flat'` | No | — | Trend direction |
| `trendValue` | `string` | No | — | Trend delta ("+12%", "-3.2") |
| `trendPeriod` | `string` | No | — | Comparison period ("vs last month") |
| `status` | `'good' \| 'warning' \| 'critical'` | No | — | Color coding |

**Visual:** Large value, smaller label, trend arrow colored green/red/gray. Compact enough for 3-4 side by side.

**Interaction:** Click → emits `{ type: 'drill_down', metric: label }`

---

#### DataTable Component

**A2UI type:** `DataTable`
**Purpose:** Interactive sortable/filterable data table.

**Properties:**

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | Yes | — | Table title |
| `columns` | `ColumnDef[]` | Yes | — | Column definitions |
| `rows` | `any[][]` | Yes | — | Row data |
| `sortable` | `boolean` | No | `true` | Enable column sort |
| `filterable` | `boolean` | No | `true` | Enable column filter |
| `pageSize` | `number` | No | `25` | Rows per page |
| `maxHeight` | `string` | No | `"400px"` | Max height before scroll |

**ColumnDef:**

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Column identifier |
| `label` | `string` | Display header |
| `type` | `'string' \| 'number' \| 'date' \| 'status' \| 'currency'` | For formatting and sort |
| `align` | `'left' \| 'center' \| 'right'` | Text alignment |

**Interactions:** Column header click → sort. Filter icon → filter input. Row click → emits drill-down action.

---

#### RAGIndicator Component

**A2UI type:** `RAGIndicator`
**Purpose:** Red/Amber/Green status display.

**Properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | What this status is for |
| `status` | `'red' \| 'amber' \| 'green'` | Yes | The RAG status |
| `detail` | `string` | No | Explanation text |
| `metric` | `string` | No | Underlying metric value |
| `threshold` | `string` | No | What threshold triggered this status |

**Interaction:** Click → emits `{ type: 'detail_request', label, status }`

---

#### InsightCard Component

**A2UI type:** `InsightCard`
**Purpose:** Styled card for the agent's text-based insight or summary.

**Properties:**

| Property | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Insight title |
| `body` | `string` | Yes | Insight text (supports markdown) |
| `icon` | `'info' \| 'warning' \| 'success' \| 'tip'` | No | Icon type |
| `priority` | `'high' \| 'medium' \| 'low'` | No | Visual emphasis level |

---

#### CompositeDashboard Component

**A2UI type:** `CompositeDashboard`
**Purpose:** Container that arranges multiple child components in a grid layout.

**Properties:**

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | Yes | — | Dashboard title |
| `layout` | `'auto' \| '2-column' \| '3-column' \| '1-top-2-bottom'` | No | `"auto"` | Grid layout |
| `children` | `string[]` | Yes | — | A2UI node IDs of child components |

**How it works:** The CompositeDashboard node references child node IDs in the same A2UI surface. The renderer resolves children and lays them out per the `layout` property. Auto layout: KPI cards in a row at top, charts below in a grid.

---

### 6.3 Fallback Rendering Strategy

When A2UI payload contains an unrecognized component type:

1. A2UIEventService checks each node's `type` against the registered catalog
2. If unknown type found → log warning
3. Render known components via A2UI renderer
4. For unknown components → render a fallback card showing formatted data with message: "Visualization type not supported — showing raw data"
5. App never breaks, even if agent generates something unexpected

### 6.4 Chart Color Palettes

| Palette Name | Use Case |
|---|---|
| `default` | General purpose — 6 distinct colors (blue, teal, orange, purple, pink, amber) |
| `sequential` | Low-to-high gradients — light blue → dark blue (7 stops) |
| `diverging` | Positive/negative — red → gray → green |
| `status` | RAG-aligned — green, amber, red |
| `categorical` | Many categories — 12 distinct, colorblind-safe colors |

All palettes must be colorblind-safe (tested against deuteranopia and protanopia).

---

## 7. AG-UI Integration — Event Flow

### 7.1 When User Sends a Message

1. InputBarComponent calls ChatStateService.sendMessage(text)
2. ChatStateService adds user message to messages signal, generates a run ID
3. ChatStateService calls AgUiService.runAgent() with:
   - `messages`: full conversation history
   - `state`: current AgentContext from SharedStateService
   - `runId`: unique ID
   - `threadId`: session ID
4. AgUiService creates HttpAgent run, begins consuming SSE stream

### 7.2 Event-to-Action Mapping

| AG-UI Event | Angular Action |
|---|---|
| `RUN_STARTED` | Set isStreaming = true |
| `TEXT_MESSAGE_START` | Create new assistant message shell in ChatStateService |
| `TEXT_MESSAGE_CONTENT` | Append delta text to current message content |
| `TEXT_MESSAGE_END` | Mark message as complete |
| `TOOL_CALL_START` | Add tool call info to current message ("Querying database...") |
| `TOOL_CALL_ARGS` | Stream tool call arguments (optionally show SQL being generated) |
| `TOOL_CALL_END` | Mark tool call complete |
| `STATE_DELTA` | Apply JSON Patch to SharedStateService.agentContext |
| `CUSTOM` (name: `a2ui_surface_update`) | Extract A2UI payload → A2UIEventService → attach to message + update canvas |
| `RUN_FINISHED` | Set isStreaming = false |
| `RUN_ERROR` | Set error message, set isStreaming = false |

### 7.3 Drill-Down Interaction Flow

1. User clicks a bar segment on Graph component in canvas
2. Graph component emits A2UI action: `{ type: 'drill_down', label: 'West', value: 45000, datasetLabel: 'Revenue' }`
3. CanvasPanelComponent catches the action
4. Constructs follow-up message: "Show details for West region from the Revenue chart"
5. Calls ChatStateService.sendMessage() with this text
6. AgUiService sends message + current shared state (includes `currentVisualization` with source query)
7. Agent receives the NL request AND the structured context about what's displayed
8. Agent generates drill-down query and new visualization

### 7.4 Cancellation

- User clicks Cancel → AgUiService aborts SSE via AbortController
- Current streaming message preserved with content received so far
- isStreaming set to false
- User can send new message immediately

---

## 8. Chat Panel Design

### 8.1 Message Bubbles

**User messages:** Right-aligned, subtle accent background, plain text, timestamp below.

**Assistant messages:** Left-aligned, white/gray-50 background, rendered via ngx-markdown. If message has A2UI payload: clickable thumbnail card below text. If message has tool calls: collapsible "Agent Activity" section.

### 8.2 Chart Thumbnail in Chat

When the agent sends a visualization, the chat shows a compact preview card:
- Chart title + small static preview (Chart.js rendered to small canvas)
- "View on canvas →" link
- Clicking switches canvas to display that visualization
- Chat history retains references to all past visualizations

### 8.3 Input Bar

- Auto-resizing textarea (grows with content, max 4 lines then scrolls)
- Send button (enabled when text non-empty and not streaming)
- Cancel button (visible only during streaming, replaces Send)
- Enter to send, Shift+Enter for newline
- Placeholder: "Ask about your data..."
- During streaming: input NOT disabled — user can type next question

### 8.4 Tool Call Transparency

Collapsible section in assistant message bubble:
- Header: "🔧 Agent Activity" with expand/collapse chevron
- Collapsed by default after completion
- While running: animated "Querying database..."
- Complete: "Queried PostgreSQL — 1,247 rows in 340ms"
- Expanded view: shows SQL query in code block (ngx-markdown syntax highlighting)

### 8.5 Streaming UX

- Text streams token by token via TEXT_MESSAGE_CONTENT events
- Typing indicator (three animated dots) before first token
- Markdown re-renders live as tokens arrive
- Auto-scroll to bottom as content arrives (unless user has scrolled up)
- If user scrolled up during streaming: "↓ New message" pill at bottom to jump back

---

## 9. Visualization Canvas Design

### 9.1 Canvas States

| State | Display |
|---|---|
| Empty (no conversation) | Welcome message with 3-4 example questions as clickable cards |
| Empty (conversation, no viz yet) | "Ask a question to see visualizations here" |
| Loading | Skeleton loader matching expected chart area |
| Active visualization | Full-size A2UI rendered component(s) |
| Error | Error message with retry option |

### 9.2 Canvas Toolbar

- **Title**: current visualization title
- **Fullscreen**: toggle fullscreen for canvas
- **Zoom**: +/- controls (useful for data tables)
- **History**: dropdown of past visualizations in this conversation (click to re-display)

### 9.3 Canvas Interaction Events

| Component | Action | Angular Response |
|---|---|---|
| Graph (bar click) | `drill_down` | Send drill-down message to agent |
| Graph (legend click) | `toggle_series` | Toggle series visibility (local, no agent call) |
| DataTable (row click) | `row_select` | Send "Tell me more about [row]" to agent |
| DataTable (sort/filter) | `sort_change` / `filter_change` | Local handling only |
| KPICard (click) | `drill_down` | Send "Break down [metric]" to agent |
| RAGIndicator (click) | `detail_request` | Send "Why is [item] red/amber?" to agent |

**Rule:** Only actions needing deeper analysis trigger agent calls. Pure UI interactions (sort, toggle, zoom) are local.

---

## 10. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `sm` | ≥640px | Mobile — single panel + toggle |
| `md` | ≥768px | Tablet — tabbed (Chat \| Canvas) |
| `lg` | ≥1024px | Desktop — split view |
| `xl` | ≥1280px | Desktop wide — more canvas space |

### Component Adaptations

| Component | Desktop | Tablet | Mobile |
|---|---|---|---|
| SplitView | Side-by-side, resizable | Tabbed | Single panel + toggle |
| Graph | Full canvas width | Full tab width | Full screen width |
| DataTable | Horizontal scroll if needed | Horizontal scroll | Card view per row |
| CompositeDashboard | Grid layout | Stacked | Stacked |
| KPICard | 3-4 per row | 2 per row | 1 per row |
| InputBar | Fixed at chat panel bottom | Fixed at bottom | Fixed at screen bottom |

---

## 11. Theming & Styling

### Tailwind Configuration

- Extend Tailwind with custom analytics-domain colors
- Define `chart` color palette for chart consistency
- Define `status` colors (green, amber, red) for RAG
- Use Tailwind dark mode class strategy (future: dark mode toggle)

### A2UI Theme

- A2UI Angular renderer accepts theme object via `provideA2UI({ theme })`
- Map theme tokens to Tailwind utility classes
- Override A2UI defaults via `a2ui-theme.css`
- Ensure A2UI components match the rest of the app

### Typography

- System font stack or clean sans-serif (Inter or org's preferred)
- Chat messages: 14-15px body
- Chart titles: 16px semibold
- KPI values: 28-32px bold
- Code blocks: monospace, slightly smaller

---

## 12. Error Handling

| Scenario | UX Response |
|---|---|
| Backend unreachable | Banner: "Unable to connect. Retrying..." (exponential backoff) |
| SSE stream interrupted | Preserve partial response, "Response interrupted" + retry button |
| Agent returns error | Error in chat: "I encountered an error: [msg]. Try rephrasing." |
| A2UI payload invalid | Fallback rendering (raw data view), log warning |
| Chart rendering fails | Error card in canvas + data table view as fallback |
| User sends while streaming | Cancel current stream, send new message |

---

## 13. Performance Considerations

- Lazy load A2UI catalog components — dynamic imports, loaded only when first needed
- Virtual scroll for message list — Angular CDK virtual scroll for long conversations
- Debounce shared state updates — batch rapid STATE_DELTA events during streaming
- Chart.js canvas management — destroy and recreate charts (avoids memory leaks)
- Limit message history sent to agent — cap at last 50 messages (shared state carries structured context)
- SSE connection management — single connection per run, clean up on cancel/complete/error

---

## 14. E2E Testing — Playwright

### 14.1 Testing Approach

All Playwright tests run against the **real backend + Gemini**. This is true end-to-end testing — no mocks, no SSE stubs. The tests verify the full flow from user input through agent processing to rendered visualization.

**Key implication:** Tests are slower (5-30 seconds per test depending on Gemini response time) and non-deterministic (LLM responses vary). Test assertions are designed around **structural correctness** rather than exact content matching.

**What we assert:**
- A chart rendered (not what exact values it shows)
- The chart type is correct (bar chart, not line chart)
- The chart has a title
- A drill-down produced a new visualization
- An error state displayed correctly
- The right number of messages exist in the chat

**What we do NOT assert:**
- Exact text content of agent responses
- Exact number of data points on a chart
- Specific SQL queries the agent chose
- Exact chart labels or legend text

### 14.2 Prerequisites

Before tests run, the following must be available:

| Dependency | Required State |
|---|---|
| FastAPI backend | Running on `http://localhost:8080` |
| PostgreSQL | Running with seed data loaded |
| Gemini API | Accessible (valid `GOOGLE_API_KEY` set) |
| Angular dev server | Running on `http://localhost:4200` |

The `global-setup.ts` file performs a health check on the backend (`GET /health`) before any tests execute. If the backend is unreachable, all tests are skipped with a clear error message.

### 14.3 Playwright Configuration

| Setting | Value | Rationale |
|---|---|---|
| `timeout` | 60000 (60s) | Agent responses can take 10-30s (LLM + SQL + A2UI generation) |
| `expect.timeout` | 30000 (30s) | Chart rendering may take time after SSE stream completes |
| `retries` | 2 | Non-deterministic LLM responses may occasionally fail assertions |
| `workers` | 1 | Serial execution — shared backend state, avoid session conflicts |
| `projects` | Desktop (1280×800), Tablet (768×1024), Mobile (375×812) | Three viewport sizes |
| `baseURL` | `http://localhost:4200` | Angular dev server |

### 14.4 Test Helper Library

Reusable helpers abstract common patterns so tests stay readable. Tests should not contain raw Playwright selectors for app-specific elements.

#### chat.helpers.ts

| Helper | Purpose |
|---|---|
| `sendMessage(page, text)` | Types text in input bar, clicks Send, waits for message to appear in chat |
| `waitForAgentResponse(page, options?)` | Waits until streaming completes (isStreaming indicator disappears). Options: `timeout`, `expectVisualization` |
| `getMessages(page)` | Returns all message bubbles with role and text content |
| `getLastAssistantMessage(page)` | Returns the most recent assistant message content |
| `waitForToolCallDisplay(page)` | Waits for the "Agent Activity" section to appear on the latest message |
| `expandToolCallDetails(page)` | Clicks to expand the Agent Activity section, returns SQL text |
| `clickCancel(page)` | Clicks the Cancel button during streaming |

#### canvas.helpers.ts

| Helper | Purpose |
|---|---|
| `waitForChart(page, options?)` | Waits for a chart to render on the canvas. Options: `chartType`, `timeout` |
| `getChartTitle(page)` | Returns the title of the currently displayed chart |
| `getCanvasState(page)` | Returns current canvas state: 'empty', 'loading', 'active', 'error' |
| `clickChartElement(page, label)` | Clicks a specific element on the chart (bar, slice, point) by its label |
| `getVisualizationType(page)` | Returns what A2UI component type is rendered ('Graph', 'DataTable', 'KPICard', etc.) |
| `getKPIValue(page, label)` | Returns the value displayed on a KPICard with the given label |
| `getTableRowCount(page)` | Returns the number of visible rows in a DataTable |
| `clickHistoryDropdown(page, index)` | Opens the visualization history dropdown and selects an item by index |

#### assertions.helpers.ts

| Helper | Purpose |
|---|---|
| `expectChartRendered(page, chartType?)` | Asserts a chart is visible on canvas, optionally of a specific type |
| `expectMessageCount(page, count)` | Asserts the total number of messages in the chat |
| `expectStreamingComplete(page)` | Asserts that no streaming indicator is visible |
| `expectCanvasNotEmpty(page)` | Asserts the canvas is not in empty/loading state |
| `expectErrorDisplayed(page, pattern?)` | Asserts an error message is shown, optionally matching a regex |

### 14.5 Test Specifications

---

#### TC-01: Chat Basics (`chat-basics.spec.ts`)

**Tests the fundamental chat interaction — send a message, receive a streamed response.**

| Test | Steps | Assertions |
|---|---|---|
| Send a simple question | Send "How many tables are in the database?" | Agent responds with text containing a number. Message count = 2 (user + assistant). Streaming completes. |
| Message appears in chat | Send any question | User message appears right-aligned. Assistant message appears left-aligned. |
| Markdown rendering | Send "List the columns in the projects table" | Response contains formatted content (agent typically returns column names in a structured way). No raw markdown syntax visible. |
| Empty state on load | Navigate to app fresh | Chat shows no messages. Canvas shows welcome/empty state. Input bar is focused. |

---

#### TC-02: Chart Rendering (`chart-rendering.spec.ts`)

**Tests that the agent generates charts and they render correctly on the canvas.**

| Test | Steps | Assertions |
|---|---|---|
| Bar chart renders | Send "Show revenue by region" | Canvas has an active visualization. Visualization type is Graph. Chart has a title. Chart title contains relevant keywords ("revenue" or "region"). |
| Line chart renders | Send "Show monthly revenue trend for 2025" | Canvas has an active visualization. Chart type is line or area. |
| Pie chart renders | Send "Show the distribution of project statuses" | Canvas has an active visualization. Chart type is pie or doughnut. |
| Data table renders | Send "List all projects with their budgets" | Canvas has a DataTable component. Table has rows (row count > 0). |
| KPI card renders | Send "What is the total revenue?" | Canvas has a KPICard component. KPI has a value displayed. |
| Chart thumbnail in chat | Send a chart-generating question | Assistant message in chat has a clickable thumbnail/preview card. |

---

#### TC-03: Drill-Down (`drill-down.spec.ts`)

**Tests the full drill-down flow — click a chart element, agent receives context, generates deeper visualization.**

| Test | Steps | Assertions |
|---|---|---|
| Click bar triggers drill-down | Send "Show revenue by region" → wait for chart → click a bar segment | A new user message appears in chat (auto-generated drill-down text). Agent responds. A new/updated visualization appears on canvas. Message count increases by 2 (auto user message + agent response). |
| Drill-down has different data | Send revenue by region → drill into one region | The new chart title or content references the drilled region. The visualization changed (not the same chart). |
| KPI drill-down | Send "What is the total project budget?" → click the KPI card | Agent responds with a breakdown. New visualization appears. |

---

#### TC-04: Multi-Turn Context (`multi-turn.spec.ts`)

**Tests that the agent maintains conversational context across multiple turns.**

| Test | Steps | Assertions |
|---|---|---|
| Follow-up question | Send "Show revenue by region" → wait → send "Now break that down by quarter" | Agent responds with a new chart that incorporates both region and quarter. No error about missing context. |
| Reference "that" | Send a chart-generating question → send "Show that as a table instead" | A DataTable appears instead of the previous chart. |
| Three-turn conversation | Send question 1 → follow-up 1 → follow-up 2 | All 6 messages visible (3 user + 3 assistant). No errors. Last response still contextually relevant. |

---

#### TC-05: Data Table Interactions (`data-table.spec.ts`)

**Tests DataTable-specific local interactions.**

| Test | Steps | Assertions |
|---|---|---|
| Table renders with data | Send "List all projects" | DataTable visible. Has multiple rows. Has column headers. |
| Column sort | Send table-generating question → click a column header | Rows reorder (first row changes). No agent call made (no new messages). |
| Row click triggers detail | Send table question → click a data row | New message appears in chat. Agent responds with detail. |

---

#### TC-06: KPI Dashboard (`kpi-dashboard.spec.ts`)

**Tests composite dashboard rendering with multiple KPIs and charts.**

| Test | Steps | Assertions |
|---|---|---|
| Dashboard renders | Send "Give me a project health dashboard" | Canvas shows a CompositeDashboard or multiple components. At least one KPI card visible. At least one chart visible. |
| Multiple KPIs | Send "Show key project metrics" | Multiple KPI cards rendered with different labels. |

---

#### TC-07: Tool Transparency (`tool-transparency.spec.ts`)

**Tests that the Agent Activity section shows tool call information.**

| Test | Steps | Assertions |
|---|---|---|
| Tool call section exists | Send any data question | Agent Activity section appears on the assistant message. |
| Shows SQL query | Send data question → expand Agent Activity | Expanded section contains SQL text (contains SELECT keyword). |
| Shows execution time | Expand Agent Activity | Section shows execution time information. |

---

#### TC-08: Streaming UX (`streaming-ux.spec.ts`)

**Tests the streaming experience — typing indicator, progressive rendering, cancellation.**

| Test | Steps | Assertions |
|---|---|---|
| Typing indicator shows | Send a question, immediately check | Typing indicator is visible before first token arrives. |
| Streaming completes | Send a question, wait | Typing indicator disappears. Message content is non-empty. |
| Cancel mid-stream | Send a question → immediately click Cancel | Streaming stops. Partial message content preserved (may be empty if cancelled fast). Send button re-enabled. |
| Send after cancel | Cancel → send a new question | New response arrives successfully. No error state. |

---

#### TC-09: Canvas States (`canvas-states.spec.ts`)

**Tests the various states of the visualization canvas.**

| Test | Steps | Assertions |
|---|---|---|
| Empty state on load | Fresh page load | Canvas shows welcome/empty state with example question cards. |
| Example question clickable | Click an example question card | Message sent in chat. Agent responds. |
| Loading state | Send a question, immediately check canvas | Canvas shows loading/skeleton state (before chart arrives). |
| History dropdown | Generate chart 1 → generate chart 2 → open history | History dropdown has at least 2 items. Clicking first item restores the earlier chart. |

---

#### TC-10: Responsive Layout (`responsive.spec.ts`)

**Tests layout behavior at different viewport sizes. Uses Playwright's `projects` for viewport configuration.**

| Test | Viewport | Assertions |
|---|---|---|
| Desktop split view | 1280×800 | Both chat panel and canvas visible simultaneously. |
| Tablet tabbed | 768×1024 | Tabs visible ("Chat" and "Canvas"). Only one panel visible at a time. |
| Tablet auto-switch | 768×1024 | Send question → when chart arrives, auto-switches to Canvas tab. |
| Mobile single panel | 375×812 | Single panel visible. Toggle button present. Input bar at bottom. |
| Mobile toggle | 375×812 | Click toggle → switches between chat and canvas views. |

---

#### TC-11: Error Handling (`error-handling.spec.ts`)

**Tests error states and recovery. Some tests may require backend manipulation (e.g., stopping the server).**

| Test | Steps | Assertions |
|---|---|---|
| Backend unavailable | Stop backend → send message | Error banner/message displayed. No infinite loading. |
| Recovery after error | Stop backend → send message → restart backend → send message | Second message gets a successful response. |
| Agent error | Send a question that's likely to cause an agent error (e.g., "Query the nonexistent_table_xyz") | Error message displayed in chat. App doesn't crash. User can send another message. |

### 14.6 Running Tests

**Commands:**

| Command | Purpose |
|---|---|
| `npx playwright test` | Run all tests (all viewports) |
| `npx playwright test --project=desktop` | Run desktop tests only |
| `npx playwright test tests/chat-basics.spec.ts` | Run a single test file |
| `npx playwright test --retries=3` | Run with more retries for flaky LLM tests |
| `npx playwright show-report` | Open HTML test report |
| `npx playwright test --ui` | Interactive UI mode for debugging |

**Before running:**
1. Start PostgreSQL with seed data
2. Start FastAPI backend: `uvicorn main:app --port 8080`
3. Start Angular: `ng serve`
4. Run tests: `npx playwright test`

### 14.7 Dealing with Non-Determinism

Since tests run against real Gemini, LLM responses vary. Strategies:

| Strategy | Implementation |
|---|---|
| Structural assertions | Assert "a chart rendered" not "chart has 5 bars labeled X,Y,Z" |
| Keyword matching | Assert response "contains" relevant terms, not exact text |
| Generous timeouts | 60s test timeout, 30s expect timeout for slow LLM responses |
| Retries | 2 automatic retries per test — if first attempt gets an unusual response, retry |
| Stable prompts | Use questions that have low ambiguity: "Show revenue by region" not "Tell me about the data" |
| Avoid ordering assumptions | Don't assert which chart type the agent picks for ambiguous questions |
| Health-gated runs | global-setup verifies backend + DB + Gemini are healthy before any tests run |

---

## 15. Phase 2 Frontend Additions (Design for Extensibility)

| Feature | Frontend Impact |
|---|---|
| Rally integration | No frontend changes — new backend tool, same A2UI output |
| Chart type switching | Dropdown in canvas toolbar, updates shared state, agent re-renders |
| Inline filters | Filter bar above canvas, bound to shared state activeFilters |
| Save/pin visualization | "Pin" button in toolbar, persisted view list in sidebar |
| Export chart | Chart.js `toBase64Image()` for PNG; html2canvas for dashboards |
| Share conversation | Shareable link with conversation ID |
| Persistent history | Sidebar with past conversations |
| Dark mode | Tailwind `dark:` variant + A2UI theme toggle |
| Burndown / velocity | New A2UI catalog components; same DynamicComponent pattern |
