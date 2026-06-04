# ChronoMart UI

React + Vite + TypeScript + Tailwind shopfront for the
[ChronoMart](https://github.com/kushagraThapar/chronomart-app) multi-SDK Cosmos DB
testing harness.

The UI sends every API request through the gateway (`/api/v1/*`) and tags it with a
`X-Cosmos-SDK` header. Switch the SDK from the header dropdown — the page does not
reload; the next request hits the backend implemented in that language.

## Quick start

The UI needs the [chronomart-app](https://github.com/kushagraThapar/chronomart-app) stack
running (gateway on http://localhost:8000).

```bash
npm install
npm run dev          # http://localhost:5173 — proxies /api → http://localhost:8000
```

Override the gateway URL: `VITE_GATEWAY_URL=https://staging.gw.example npm run dev`

## Layout

```
src/
├── api/                # fetch wrapper + types (replace with openapi-typescript-codegen output in Phase 1)
├── components/         # shared bits (header, SdkSwitcher, PageShell)
├── hooks/              # useCapabilities, useSelectedSdk
├── pages/              # one page per route, each gated by a capability flag
├── App.tsx             # router shell
├── main.tsx            # entry
└── index.css           # Tailwind 4 entry + theme tokens
```

## Capability-aware UI

Every page asks `GET /api/v1/_meta/capabilities` (cached 60s) and renders a
"feature unsupported" badge when the active backend can't fulfill it. As more
features land in the contract, add them to the page header's `feature` prop.

## Phase 1 follow-ups

- Replace `api/client.ts` with `openapi-typescript-codegen`-generated client wired to the
  committed `chronomart-app/contracts/openapi.yaml`.
- Fill in pages with real data (catalog grid, cart drawer, order history table…).
- Add E2E playwright tests against the docker-compose stack.
