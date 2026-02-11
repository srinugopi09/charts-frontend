# Agentic Analytics Chatbot - Frontend

Conversational analytics app where users ask natural-language questions about data and receive text responses with interactive visualizations. Built with Angular 21, Chart.js, and Tailwind CSS.

## Prerequisites

- **Node.js** >= 20 (LTS recommended)
- **npm** >= 11
- **Backend** running on `http://localhost:8080` ([charts-backend](https://github.com/srinugopi09/charts-backend) repo)

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/srinugopi09/charts-frontend.git
cd charts-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the backend

The frontend expects the FastAPI backend running on port 8080. Follow the setup instructions in the [backend repo](https://github.com/srinugopi09/charts-backend).

### 4. Start the dev server

```bash
npm start
```

Open [http://localhost:4201](http://localhost:4201) in your browser.

## Available Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm start`            | Dev server on port 4201 with live reload |
| `npm run build`        | Production build to `dist/`              |
| `npm test`             | Unit tests (Vitest)                      |
| `npx playwright test`  | E2E tests (requires backend running)     |

## Project Structure

```text
src/
  app/
    core/
      config/          # Feature flags
      services/        # AgUiService, ChatStateService, SharedStateService,
                       # A2UIEventService, ChartAdapterService
    features/
      chat/            # Chat panel, message components
      canvas/          # Canvas panel, toolbar
      layout/          # Split-view (responsive)
    a2ui-catalog/      # A2UI components: Graph, KPICard, DataTable,
                       # RAGIndicator, InsightCard, CompositeDashboard
  environments/        # API URLs per environment
```

## Architecture

- **Agent Protocol:** AG-UI (SSE streaming via `@ag-ui/client`)
- **UI Rendering:** A2UI dynamic component catalog (`@a2ui/angular`)
- **Charts:** Chart.js 4.x rendered on canvas
- **State:** Angular signals (no NgRx)
- **Layout:** Responsive split-view with chat + visualization canvas
  - Desktop: side-by-side with draggable divider + fullscreen toggle
  - Tablet: tab switching
  - Mobile: single panel with toggle

## E2E Tests

Tests use Playwright against a real backend (no mocks). The backend + Gemini must be running.

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run tests
npx playwright test

# Run with UI
npx playwright test --ui
```

## Configuration

| Setting         | File                                   | Default                  |
| --------------- | -------------------------------------- | ------------------------ |
| API URL         | `src/environments/environment.ts`      | `http://localhost:8080`  |
| Dev server port | `package.json` (`start` script)        | `4201`                   |
| Feature flags   | `src/app/core/config/feature-flags.ts` | See file                 |
