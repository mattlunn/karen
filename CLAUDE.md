# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Karen is a full-stack TypeScript/Node.js smart home automation platform with:
- **Backend**: Express.js server with REST API
- **Frontend**: React 18 SPA
- **Database**: MySQL with Sequelize ORM
- **Real-time**: SSE (Server-Sent Events) for live device updates
- **Integrations**: Alexa, Z-Wave, Tado, Shelly, TP-Link, UniFi, Synology, HomeConnect, eBUSd

## Development Commands

All commands run from `/server/src/`:

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
- `automations/` - Rule-based automation modules loaded from config.json
- `routes/` - Express route handlers for REST endpoints and webhooks
- `components/` - React components (pages/, modals/, capability-graphs/)
- `helpers/` - Utility functions (date, time, sun calculations, presence)
- `migrations/` - Database schema migrations (Umzug)

### Entry Points

- `server.ts` - Express server startup, middleware, route setup
- `client.js` - React app entry point

### Naming Conventions

- **Component files**: Use hyphenated lowercase names (e.g., `date-range-context.tsx`, not `DateRangeContext.tsx`)

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

**Event Time-Series Model**: The `events` table is used for both real-time state tracking and daily aggregates. Key fields: `start` (when the value began), `end` (when it was superseded, null if current), `lastReported` (timestamp of the last observation that confirmed this value). The helpers `setNumericProperty` and `setBooleanProperty` (`models/capabilities/helpers/index.ts`) manage event lifecycle — notably, when a new observation has the same value as the current event, no new row is created; only `lastReported` is updated.

**Event-Driven Updates**: Device changes emit events via `DeviceCapabilityEvents`, which trigger SSE (Server-Sent Events) for real-time UI updates.

**Configuration-Driven Automations**: Automations are configured in `config.json` and dynamically loaded at startup. Each automation module receives parameters and registers event handlers.

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
2. Copy `config.json` from live, empty secrets, place in `./server/src/config.json`
3. Create MySQL database and update config
4. Run `npm run migrate`
5. Run `npm run dev` (watch) and `npm run start:dev` (server) in separate terminals
6. Use ngrok for public endpoint: `https://karen-dev.ngrok.io`
