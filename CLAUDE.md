# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karen is a full-stack TypeScript/Node.js smart home automation platform with:
- **Backend**: Express.js server with REST API
- **Frontend**: React 19 SPA
- **Database**: MySQL with Sequelize ORM
- **Real-time**: SSE (Server-Sent Events) for live device updates
- **Integrations**: Alexa, Z-Wave, Tado, Shelly, TP-Link, UniFi, Synology, HomeConnect, eBUSd, Vehicle (SmartCar)

## Development Commands

All commands run from `/server/src/`:

### Node.js version

A `.nvmrc` is present in `/server/src/`. Always run `nvm use` before running any commands to ensure the correct Node.js version is active. Using the wrong version (e.g. Node 16) will cause build failures such as `findLastIndex is not a function`.

### First-time setup (required before lint/build/test)

```bash
nvm use                  # Switch to the correct Node.js version
npm install              # Install dependencies
npm run codegen          # Generate capabilities.gen.ts (not checked in)
```

**Important**: `npm run codegen` must be run before `lint:tsc` or `build`. The file `models/capabilities/capabilities.gen.ts` is generated from `capabilities.json` and is not committed to the repository. Without it, TypeScript will fail with missing type errors for capability base classes.

The CI pipeline runs in this order: `codegen` → `lint` → `test` → `build`. Follow the same order locally.

```bash
# Development (run in separate terminals)
npm run dev              # Babel watch mode - transpiles on save
npm run start:dev        # Nodemon auto-restart with pino-pretty logging

# Building
npm run build            # Full build (server + browser)
npm run build:server     # Babel transpilation to ../dist
npm run build:browser    # Webpack bundle to ../dist/static

# Linting & Testing
npm run lint             # ESLint + TypeScript check (zero-warning policy)
npm run lint:eslint      # ESLint only
npm run lint:tsc         # TypeScript type check only
npm run test             # Jest tests

# Database & Utilities
npm run migrate          # Run database migrations
npm run create-user      # Create new user via CLI
npm run codegen          # Generate TypeScript from GraphQL schema
```

## Architecture

### Directory Structure (`server/src/`)

- `api/` - API type definitions (single source of truth for REST API types)
- `models/` - Sequelize ORM models (Device, User, Room, Event, etc.)
- `models/capabilities/` - Device capability system (Light, Lock, Thermostat, etc.)
- `services/` - Integration services for each IoT platform (alexa/, tado/, shelly/, etc.)
- `automations/` - Rule-based automation modules loaded from config/automations.json
- `routes/` - Express route handlers for REST endpoints and webhooks
- `components/` - React components (pages/, modals/, capability-graphs/)
- `helpers/` - Utility functions (date, time, sun calculations, presence)
- `migrations/` - Database schema migrations (Umzug)

### Entry Points

- `server.ts` - Express server startup, middleware, route setup
- `client.js` - React app entry point

### Naming Conventions

- **Component files**: Use hyphenated lowercase names (e.g., `date-range-context.tsx`, not `DateRangeContext.tsx`)
- **Database tables vs columns**: Table names are `snake_case` and pluralised (e.g. `alarm_activations`, `armings`, `events`); column names are `camelCase` (e.g. `armingId`, `startedAt`, `suppressFurtherAlertsUntil`, `lastReported`). Sequelize models map camelCase attributes straight to camelCase columns — the codebase does **not** use `underscored: true`. Follow both when adding migrations or model fields.
- **Datetime columns are millisecond precision**: every datetime column in the schema is `DATETIME(3)`, and every model attribute that maps to one is declared `DataTypes.DATE(3)` (`Sequelize.DATE(3)` in the `.js` models), including `createdAt` / `updatedAt` / `deletedAt`. Never add a bare `DataTypes.DATE` / migration `Sequelize.DATE` — on the mysql dialect a bare `DATE` rounds a JS `Date` to whole seconds on write and drops the fractional part from `WHERE`-clause literals, so range queries built from `new Date()` truncate their bounds and disagree with the millisecond-precision JS comparisons run against the rows they return. New columns: `DATETIME(3)` in the migration, `DataTypes.DATE(3)` on the attribute.

### Coding Style

- **Always use curly braces for `if` statements**, even single-line bodies. Never write `if (x) doSomething();`.
- **Prefer `dayjs` over raw `Date` arithmetic.** For anything date/time — adding or subtracting a duration, diffing two instants, start/end of period, comparisons — go through `dayjs` (imported from `../dayjs`, never the npm package directly). Don't hand-roll millisecond maths like `new Date(Date.now() + hours * 60 * 60 * 1000)` or `(a.getTime() - b.getTime()) / 3600000`; use `dayjs().add(hours, 'hour')` and `dayjs(a).diff(b, 'hour', true)`. Converting back with `.toDate()` at the boundary is fine. Tight numeric loops over fixed slot widths (e.g. stepping half-hour price slots) may stay as plain millisecond arithmetic where dayjs would only obscure them.
- **Blank line after a declaration group, and around blocks.** After the last `const`/`let` in a contiguous group of declarations, add a blank line before the next non-declaration statement (a call, `if`, `for`, `return`, etc.). Likewise, surround `if`/`for`/`while`/`try` blocks with a blank line before (if preceded by other statements) and after (if followed by other statements) — see `routes/api/device/timeline.ts`'s `SWITCH` case for a clean example. Exceptions, applied consistently across the codebase:
  - No blank line when the declaration is immediately consumed by the very next statement (e.g. `const capability = device.getFooCapability(); somePromise.push(...)`, or `const x = foo(); return x;`).
  - Consecutive short, related declarations can be grouped without blank lines between them — just add the one blank line before the next *distinct* statement.
  - No leading blank line for the first statement right after an opening `{`, and none right before a closing `}` — including a guard clause that's the first line of a function.
  - Trivial one- or two-statement bodies don't need any separating blank lines (nothing to separate).
- **Comment sparingly.** Only add a comment where the logic or its purpose isn't clear from the code itself — an external constraint, a non-obvious edge case, a reason for doing something the unexpected way. Don't restate what the code plainly says. In particular, a doc comment that just paraphrases a well-named function/variable and its signature is pure noise — leave it out. Prefer naming the thing well over explaining a vague name.
  - Bad (on `getPlannedChargeBlocks(): { start; end }[]`): `// The charge blocks the scheduler is currently driving, for showing planned run windows in the UI.`
  - Good: no comment — or, if there's a real subtlety, comment only that: `// Empty between a committed window ending and the next one being planned.`
  - **A new function gets no comment by default.** Add one only if you can point to a specific fact it carries that isn't already in the signature or body: an external constraint, an ordering/timing dependency, a cross-function interaction, or a reason for doing something the non-obvious way. "It summarises what the function does" is not such a fact — nor is "the function has several branches".
  - **Nearby comments are not licence.** If surrounding functions carry header comments, match their *bar* (genuine rationale), not their *frequency*. Most well-named functions need none.
  - Before committing, re-read every comment you added and ask: could a competent reader get this from the code in ~10 seconds? If yes, delete it.
  - Bad (on `resolveTarget()`): `// Legionella temp when overdue, plunge temp on negative prices, else standard.` — Good: no comment; the branch conditions and the returned enum already say it.
- **Never leave temporal comments.** Write comments in the present tense, describing the code as it stands right now — not its history. A comment explains the current behaviour to whoever reads it next; it isn't a changelog, and git history already records what changed and why. This rules out more than just "used to" phrasing: drop any clause that only makes sense by reference to a prior or alternate version of the code — what a previous version got wrong, what a change fixed, or a contrast against an approach that's since been removed ("not the old X", "wider than Y used to be", "the naive approach would..."). If an alternative is worth mentioning at all, describe it as a general tradeoff a reader could reconstruct from first principles, not as something *this codebase* used to do. A comment should read the same the day it's written and five years later, once nobody remembers what came before it. For example:
  - Good: `// Alexa sends LaunchRequest and SessionEndedRequest to any skill, neither of which carries an intent.`
  - Bad: `// Alexa sends LaunchRequest and SessionEndedRequest to any skill, neither of which carries an intent. Reading .name off them used to throw, which Alexa reads out as an error.`
  - Good: `// Splitting into fixed buckets guarantees one option per slice of the window, rather than the cheapest N options clustering wherever prices happen to be lowest right now.`
  - Bad: `// The old code ranked every hour by cost and took the 4 cheapest overall, which clustered them at 9/10/11/12; bucketing spreads them out instead.`

### REST API Type System

**All TypeScript definitions for REST API endpoints MUST be centralized in `/server/src/api/types.ts`**.

This file serves as the single source of truth for:
1. **Request body types** (PUT/POST payloads sent by browser/lambda)
2. **Response types** (JSON returned by each route)
3. **Shared types** (capabilities, devices, status enums

**Critical Requirements:**

- Use **discriminated union types** for capabilities (NOT `Record<string, unknown>`)
- Export all request/response interfaces
- Import these types in:
  - Server route handlers (`/routes/api/**/*.ts`)
  - React components and hooks (`/components/**/*.js`, `/hooks/**/*.js`)
  - Lambda functions (`/lambdas/**/*.ts`)

**Example Pattern:**

```typescript
// In /server/src/api/types.ts
export interface LightUpdateRequest {
  isOn?: boolean;
  brightness?: number;
}

export interface LightResponse {
  id: number;
  name: string;
  status: DeviceStatus;
  light: {
    isOn: boolean;
    brightness: number | null;
  };
}

// Discriminated union for type safety
export type RestCapabilityData = {
  type: 'LIGHT';
  isOn: boolean;
  brightness: number | null;
} | {
  type: 'THERMOSTAT';
  targetTemperature: number;
  currentTemperature: number;
  isHeating: boolean;
  power: number;
} | {
  type: 'CAMERA';
  snapshotUrl: string;
}; // etc.

// In route handler
import { LightUpdateRequest, LightResponse } from '../../../api/types';
```

**Device Response Mapping:**

Use the `mapDeviceToResponse()` helper from `/routes/api/device-helpers.ts` to standardize device responses:

```typescript
import { mapDeviceToResponse } from '../device-helpers';

const response = mapDeviceToResponse(device, isConnected, {
  light: { isOn, brightness }
});
```

### Key Patterns

**Device Provider System**: Integrations register via `Device.registerProvider()` to expose capabilities:
```typescript
Device.registerProvider('providerName', {
  getCapabilities(device): string[],
  provideCapabilityName(): { action() }
})
```

**Capability Codegen**: Capability classes are auto-generated from `capabilities.json` via Handlebars templates (`codegen/templates/capabilities.ts.hbs`) into `models/capabilities/capabilities.gen.ts`. Run `npm run codegen` after changing `capabilities.json` or the template. Do not hand-edit `capabilities.gen.ts`.

**`device.meta` vs `capabilities.json`**: Use `device.meta` only for provider-specific runtime data that stays within that provider's own code (e.g. Shelly's hardware `generation`, Vehicle's `chargeSchedule`). If a property needs to be accessible to automations or the API in a provider-agnostic way — even if it's static config rather than a live sensor reading — add it to `capabilities.json` instead. Custom capability subclass methods (like `getNextScheduledChange`) are for provider-specific *behaviours* that can't be meaningfully generalised across providers, not for properties.

**Available Capabilities**: Light, Lock, Thermostat, Switch, Camera, Speaker, BatteryLevelIndicator, BatteryLowIndicator, HeatPump, HumiditySensor, TemperatureSensor, LightSensor, MotionSensor, ElectricVehicle, BinCollection.

**Custom Capability Subclasses**: For capabilities that need methods beyond codegen'd event properties, set `"capabilityModelClassName": "FooBase"` in `capabilities.json` so codegen generates a base class (e.g. `FooBaseCapability`), then create a custom subclass `FooCapability` extending it (e.g. `models/capabilities/bin-collection.ts`). Export the custom class from `models/capabilities/index.ts`.

**Event Time-Series Model**: The `events` table is used for both real-time state tracking and daily aggregates. Key fields: `start` (when the value began), `end` (when it was superseded, null if current), `lastReported` (timestamp of the last observation that confirmed this value). The helpers `setNumericProperty` and `setBooleanProperty` (`models/capabilities/helpers/index.ts`) manage event lifecycle — notably, when a new observation has the same value as the current event, no new row is created; only `lastReported` is updated.

**Weekly/Daily Aggregation Pattern**: For aggregating time-series data over periods (e.g., weekly mileage for ElectricVehicle, daily metrics for HeatPump), follow the pattern in `services/ebusd/history.ts` and `services/vehicle/mileage.ts`:
- Calculate aggregates periodically (e.g., every 15 minutes)
- Store using the start of the period as the timestamp (e.g., Monday 00:00 for weekly data)
- Use the same timestamp to update existing events rather than creating duplicates
- Fill historical gaps by querying the last stored period and calculating forward
- **Always pass `reportedAt = now` (current time) as the third argument to the setter, distinct from `stateTimestamp` (period start).** If `reportedAt` defaults to `stateTimestamp`, the "same value" branch in `setNumericProperty` writes `lastReported = period_start` instead of the current time. The resume calculation (`dayjs(latestEvent.lastReported).startOf('day')`) then resolves back to that same period and the catch-up loop replays it on every run indefinitely — instead of jumping to today where the new value can differ and trigger a proper new event. The heat pump service demonstrates the correct pattern: `capability.setDayPowerState(value, dayStart, intervalEnd)`.

**Event-Driven Updates**: Device changes emit events via `DeviceCapabilityEvents`, which trigger SSE (Server-Sent Events) for real-time UI updates.

**Configuration-Driven Automations**: Automations are configured in `config/automations.json` (a top-level array of `{ name, parameters }`, sibling to `config/app.json` — see "Automations config" below) and dynamically loaded at startup by `automations/index.js`. Each automation module receives `parameters` and registers event handlers. Each automation exports a `parameters` Zod schema, and its default function's argument type is derived from that schema via `z.infer<typeof parameters>` — one artifact rather than two that can drift (see `automations/auto-relock.ts`). Schemas declare **no defaults**: every value comes from `config/automations.json`, so the config is the whole picture of what an automation will do. `automations/index.js` validates each entry against its schema before starting it, and throws on the first invalid entry. `automations/index.js` also watches `config/automations.json` for changes and calls `process.exit(0)` when it changes — nodemon (dev) or the container's restart policy (prod) is what actually brings the process back up with the new config; there is no in-process hot-reload, since automation modules subscribe to events at load time with no teardown path.

**Automations config**: `config/automations.json` holds no secrets (device names, timeouts, schedules only), unlike `config/app.json`. Unlike `config/app.json`, DEV and PROD deliberately do **not** share this file — each environment has its own copy, both gitignored (not git-tracked), same as `config/app.json`. See `CLAUDE.local.md` for this host's specific paths and how to reach PROD's copy for live debugging/changes — editing PROD's copy changes real production automation behaviour (door locks, heating, lights) after the next restart, so treat it accordingly.

**Runtime mutable config**: For settings that need to persist across server restarts and be changeable at runtime (e.g. feature flags, seasonal overrides), add a field to `config/app.json` and use `saveConfig()` from `helpers/config.js` to write back to disk atomically. Do NOT create a new DB settings table — `saveConfig` is the established pattern already used for Tado/Alexa/SmartCar token persistence and costs zero infrastructure.

**Capability UI Registry**: UI configuration for device capabilities is centralized in `/components/capabilities/`. When adding a new capability type, only update `registry.tsx`:

```typescript
// In /components/capabilities/registry.tsx
export const registry: CapabilityUIRegistry = {
  LIGHT: {
    priority: 30,  // Lower = shown first
    getCapabilityMetrics: (cap, device) => [
      {
        icon: faLightbulb,
        title: 'Status',
        value: cap.isOn.value ? 'On' : 'Off',  // Can be string or ReactNode
        since: cap.isOn.start,
        lastReported: cap.isOn.lastReported,
        iconColor: '#ffa24d',
        iconHighlighted: cap.isOn.value,
        onIconClick: async ({ queryClient }) => { /* toggle action */ },
      },
    ],
    getGraphs: () => [{ id: 'light', title: 'Activity' }],
  },
  // ... other capabilities
};
```

The registry provides:
- `getDeviceMetrics(device)` - Returns all metrics sorted by priority
- `getDeviceIcon(device)` - Returns the primary icon
- `getDeviceGraphs(device)` - Returns graph configurations
- `MetricDisplayProvider` - Context for compact/full display variants

Interactive controls use `onIconClick` which receives `{ openModal, closeModal, queryClient }`. The `value` field can be a React component for interactive controls (e.g., brightness dropdown).

**Metric icon semantics**: a metric's icon is a deliberate signal, not decoration. Four orthogonal `CapabilityMetric` properties drive how it renders (in `StatusItem` on the device page and in the compact `DeviceControl` cards). When adding or editing a capability, set them by meaning — do not reach for `iconColor` just to make a card look colourful:

- **`isIssue`** — the metric is in a problem state (offline, battery low, sensor triggered). Renders the icon **red**, overriding any colour, and surfaces the device in issue lists (`getDeviceIssues`). Set it whenever a state is genuinely wrong.
- **`iconHighlighted`** — the metric has a meaningful active/inactive (on/off, running/idle) state and is currently *active* (light on, heating, motion detected, charging, schedule set). When defined, the icon is neutral grey while inactive and switches to `iconColor` while active. Only set it on metrics that actually have such a state — never on plain readings.
- **`iconColor`** — **not decorative**. Use it for exactly one of two things: (a) the colour shown while `iconHighlighted` is `true` (pair the two together — e.g. light `#ffa24d`), or (b) a genuinely intrinsic colour on a metric that has *no* active/inactive concept (rare — e.g. `BIN_COLLECTION` uses the bin's own collection colour). If a metric is just a reading (temperature, humidity, energy, odometer), leave `iconColor` unset so the icon stays neutral grey.
- **`onIconClick`** — makes the icon an interactive button. Clickable icons render as a filled `ActionIcon` (the metric's semantic colour as the background, white glyph on top) so the affordance is visible at rest; never rely on colour alone to imply clickability.

The colour resolution lives in one place — `getMetricIconColor` (`components/capabilities/helpers.ts`): `isIssue` → red; else `iconHighlighted` defined → `iconColor` when active, neutral when not; else `iconColor` if intrinsic, otherwise neutral. The default (none of the four set) is a neutral grey, non-clickable icon — correct for a plain reading.

**Exposing capability data in the UI registry**: To surface a value (live state, derived metric, or aggregate) on a device card, follow this layered flow — never short-circuit it:

1. **Source of truth**: read via the codegen'd capability methods, never the raw `Event` model. For a `Foo` property:
   - Latest event → `capability.getFooEvent()`
   - History over a window → `capability.getFooHistory({ since, until })`
   - `HistorySelector` requires both `since` and `until` — there is no all-time variant. Use `device.createdAt` as the lower bound when you genuinely want everything (e.g. a lifetime count).
2. **API mapping**: in `routes/api/device-helpers.ts`, inside the relevant `case` of `getCapabilityData`, await the capability call(s) and shape the response. Run independent capability calls in `Promise.all`. Derived values (counts, filters, sums over a momentary-event history) are computed here, not in the registry.
3. **API type**: add the new field(s) to the matching variant of `CapabilityApiResponse` in `api/types.ts`. This is the single source of truth for the wire format and is consumed by the registry.
4. **Registry**: in `components/capabilities/registry.tsx`, read the new field(s) off `cap` inside `getCapabilityMetrics`. The function is **synchronous** — no fetching here, only formatting. Each `CapabilityMetric` needs either `since + lastReported` (for live state) or an optional `footer` (for derived/aggregate values that have no single timestamp).

Two patterns for "today's X" / "this week's X" aggregates:
- *On-demand* (cheap source data, e.g. button press counts, last-pressed): query in `device-helpers.ts` per request. See the `BUTTON` case.
- *Pre-computed* (expensive integration over time-series, e.g. heat-pump watt-hours, vehicle weekly mileage): a scheduled service writes a numeric event (`setDayPowerState` etc.) and the API just reads the latest event. See `services/ebusd/history.ts` and `services/vehicle/mileage.ts`.

Pick on-demand unless the calculation is too heavy to do per-request. Adding a brand-new capability property (not just exposing an existing one) instead requires a `capabilities.json` edit and `npm run codegen` — see "Capability Codegen" above.

**Nullable capability values**: live capability state (`*StateApiResponse`) carries a `value` that is `null` until the device first reports an observation. When rendering such a value in the UI, never hand-roll a `value === null ? ... : ...` ternary. Use the `formatValueOrUnknown` helper from `helpers/format.ts`, conventionally imported aliased as `v`, which returns `-` for an unobserved value and otherwise runs the format callback:

```typescript
import { formatValueOrUnknown as v } from '../../helpers/format';

<strong>{v(capability.currentTemperature.value, (temp) => `${temp.toFixed(1)}°`)}</strong>
```

Inside `registry.tsx` this is handled centrally — `createCapability` already short-circuits a `null` value to a `-` metric, so per-capability `value` / `iconColor` / `iconHighlighted` / `isIssue` callbacks can assume a non-null value. Only the `icon` callback receives the nullable value, since each capability picks its own neutral fallback icon.

### Data Flow

1. Integration service detects device change
2. Updates Device model in database
3. Emits event via DeviceCapabilityEvents
4. SSE notifies connected clients

## Build Output

- Server: Transpiled to `/server/dist`
- Browser: Bundled to `/server/dist/static` with hashed filenames
- Docker: Published to `mattlunn/karen` on Docker Hub

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR:
1. `npm run codegen`
2. `npm run lint` (zero-warning policy enforced)
3. `npm run test`
4. `npm run build`
5. Docker build & push (master branch only)

## Local Development Setup

1. Clone this repo and `george` dependency
2. Copy `config/app.json` from live, empty secrets, place in `./server/src/config/app.json`
3. Create MySQL database and update config
4. Run `npm run migrate`
5. Run `npm run dev` (watch) and `npm run start:dev` (server) in separate terminals
6. Use ngrok for public endpoint: `https://karen-dev.ngrok.io`

## New worktree setup

Spawned worktrees are clean checkouts — `server/src/config/` (holding `app.json` and `automations.json`) is gitignored, so it never carries over automatically, and worktrees may be created by tooling (e.g. Claude Remote Control) with no interactive setup step. Before running or testing anything, from the worktree root:

```bash
mkdir -p server/src/config

if [ -f /opt/karen/config/app.json ]; then
  ln -s /opt/karen/config/app.json server/src/config/app.json
else
  echo "No shared config/app.json at /opt/karen/config/app.json — follow 'Local Development Setup' above to create server/src/config/app.json manually."
fi

if [ -f /opt/karen/config/automations.json ]; then
  ln -s /opt/karen/config/automations.json server/src/config/automations.json
else
  echo "No shared automations.json at /opt/karen/config/automations.json — see 'Automations config' below."
fi
cd server/src && npm install && npm run codegen
```
