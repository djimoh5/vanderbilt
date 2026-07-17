# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A reusable full-stack application backend and deployment library. The goal is that any frontend can drop this in and immediately have authentication, persistence, email, and cloud deployment to AWS (Lambda + API Gateway + CloudFront + S3 + MongoDB).

## Build & Run Commands

There are no npm scripts. All build/deploy orchestration is shell-script-driven.

```bash
# Install dependencies
sh ./npm-install.sh

# Compile TypeScript (outputs to ../build relative to server/)
cd server && npx tsc -p tsconfig.json

# Run dev server locally (port 8080)
cd build && node app.js

# Run with ts-node (development)
cd server && npx ts-node app.ts

# Run a deployment job directly
cd server && npx ts-node --project tsconfig.json jobs/deploy.app.ts --qa

# Full build pipeline (version-stamps + compiles + copies assets)
sh ./deploy/core.build.sh <version>

# Deploy Lambda to AWS (requires serverless CLI and AWS profile "veillance")
sh ./deploy/lambda.deploy.sh <qa|release>

# Deploy UI assets
sh ./deploy/ui.deploy.sh <qa|release>
```

TypeScript compiles from `server/` with `rootDir: ../` and `outDir: ../build`, meaning both `server/` and `model/` source trees land in `build/`.

## Architecture

### Dual-Mode Express App

The server runs as either a standard Node process or an AWS Lambda, sharing the same Express app:

| Mode | Entry Point | Behavior |
|------|------------|---------|
| Standard | `server/app.ts` → `server/server.ts` | `express.listen(8080)` |
| Lambda | `deploy/lambda/monolith.js` → `server/monolith.app.ts` | Wrapped with `serverless-http`, sets `Config.SERVERLESS = true` |

### Request Lifecycle

```
Router (router/*.ts)
  └── Controller method (@Get/@Post decorators)
        └── Service (business logic)
              └── Repository (data access)  ← server/repository/
                    └── Database (MongoDB connection pool)
```

Routes are registered via decorators on controller methods (`@Get`, `@Post`, `@Delete` in `server/controller/base.controller.ts`). The `api.factory.ts` utility processes these decorators at startup. Two routers exist: `router.ts` (standard, mounts APIController at `/api`) and `monolith.router.ts` (Lambda variant).

### Dependency Injection

Uses a custom `injection-js`-based `Injector` in `server/config/bootstrap.ts`. Services and controllers are decorated with `@Injectable()`. The bootstrap wires everything together at app start.

### Configuration System

Config is layered (highest → lowest priority):

1. `process.env.CONFIG` (JSON string) — runtime injection (used in Lambda)
2. `process.env.DEPLOY_CONFIG` (JSON string)
3. CLI args (`--release`, `--qa`, `--sprint`, `--domain`, `--bucket`)
4. `server/config/secure.config.json` (gitignored, loaded by `SecretManager`)
5. Environment class (`config.release.ts`, `config.qa.ts`, `config.sprint.ts`)
6. `config.base.ts` (defaults, dev environment, localhost MongoDB)

Environment is selected via CLI args processed in `server/config/config.ts`. Secrets (PEM keys, API keys, DB credentials) live in gitignored files under `server/config/`.

### Database

MongoDB with named connection pools defined in `Config.MONGO_CONNECTIONS`:

- `APP` — primary application data
- `AUDIT` — audit trail
- `LOG` — application logs
- `WAREHOUSE` — analytics/reporting

Connections are lazy-initialized promises, shared by ip+db combo. Access via `Database.open(DatabaseConnection.APP)` → returns `Db`.

### Authentication

- JWT tokens signed with RSA keys (`app_secret_private.pem` / `app_secret_public.pem`)
- Passwords hashed with bcrypt
- Session logic in `server/lib/session.ts`
- Auth endpoints in `server/controller/api.controller.ts`
- Auth business logic in `server/service/auth.service.ts`

### Deployment Jobs

`server/jobs/` contains long-running operations run via `ts-node`:

- `deploy.app.ts` / `ui.deploy.job.ts` — upload UI assets to S3, invalidate CloudFront
- `onboard.app.ts` / `onboard.job.ts` — environment initialization

Jobs use the same Config/Service infrastructure as the server but don't start Express.

### External Services

| Service | Integration |
|---------|------------|
| Email | Mandrill API (`server/service/email.service.ts`) |
| Storage | AWS S3 SDK (`server/service/s3.service.ts`) |
| CDN | AWS CloudFront invalidation (`server/service/cloudfront.service.ts`) |
| Serverless | Serverless Framework (`deploy/lambda/serverless.*.yml`, AWS profile `veillance`) |

## Key Files to Know

- [server/config/config.base.ts](server/config/config.base.ts) — all default config values; start here to understand what's configurable
- [server/config/bootstrap.ts](server/config/bootstrap.ts) — DI wiring; add new injectables here
- [server/controller/base.controller.ts](server/controller/base.controller.ts) — route decorator implementation
- [server/database/database.ts](server/database/database.ts) — connection pool logic
- [deploy/core.build.sh](deploy/core.build.sh) — full build pipeline with asset copying steps

## Required Secrets (gitignored)

Before running locally, `server/config/` needs:
- `secure.config.json` — MongoDB credentials, Mandrill key, AWS keys
- `app_secret_private.pem` — RSA private key for JWT signing
- `app_secret_public.pem` — RSA public key for JWT verification

The `SecretManager` in `server/config/secret-manager.ts` loads these at startup.

## Browser E2E Testing

Puppeteer-driven browser verification scripts live in `test/` (its own `package.json`, run `npm install` there once). Always add new ad-hoc/E2E puppeteer scripts to this folder — never write them to a scratch/temp directory. Drives a locally running `ng serve` (+ backend on 8080) via `puppeteer-core` against the system-installed Chrome (no bundled browser download). Screenshots land in `test/screenshots/` (gitignored). Run with `node test/<script>.js`.

## Naming Conventions

| Thing | Convention |
|---|---|
| Classes, enums, decorators | PascalCase |
| Methods, variables | camelCase |
| Constants | UPPER_SNAKE |
| File suffixes | `.service.ts`, `.repository.ts`, `.model.ts`, `.utility.ts`, `.workflow.ts` |
| DB collection names | lowercase letters and underscores only |

## Coding Best Practices

- Backend business logic should live in services, not controllers. Controllers should never call repositories directly.

- All MongoDB collection names defined in repositories should be singular. E.g. do not use "game_records", instead it should be "game_record".

- Repository names should mirror their underlying collection name. However, when using multiple words, MongoDB collections should use underscores, while repository names should use hyphens. E.g. collection name = `user_role` and repository name = `user-role.repository.ts`.

## UI Design — HARD RULE

**Angular Material is the only UI component library for this app.** `ui/` has `@angular/material` + `@angular/cdk` installed. Every screen must be built from Material components — do not hand-roll a native `<button>`, `<select>`, `<input>`, accordion, spinner, etc. when a Material equivalent exists. This is not a suggestion, it overrides any instinct to write plain HTML controls.

Use, as applicable: `mat-icon`, `mat-form-field` (+ `matInput`), `mat-select`, `mat-button`/`mat-raised-button`/`mat-icon-button`/`mat-fab`, `mat-card`, `mat-accordion`/`mat-expansion-panel`, `mat-toolbar`, `mat-sidenav`, `mat-table`, `mat-menu`, `mat-dialog`, `mat-tabs`, `mat-checkbox`, `mat-radio-button`, `mat-slide-toggle`, `mat-chip`, `mat-progress-spinner`/`mat-progress-bar`, `mat-snack-bar`, `mat-datepicker`, `mat-stepper`.

- Theming lives in `ui/src/styles.scss` via the M3 `mat.theme(...)` mixin (primary `mat.$azure-palette` to match the product's blue accent). Don't hand-write competing color tokens — extend the theme instead.
- `ui/src/index.html` loads the Material Icons font and Roboto — use `<mat-icon>iconName</mat-icon>` rather than inline SVGs or emoji for iconography.
- General look and feel should draw from monday.com's product design: clean white/light-gray surfaces, card-based panels with soft shadows and rounded corners, a blue primary accent, generous whitespace, avatar badges, and status-colored chips/labels — implemented with Material components and the theme above, not custom CSS frameworks.