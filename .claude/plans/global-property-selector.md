# Global property/period workspace selector

## Context

Today, Chart of Accounts, Trial Balance, and Documents each duplicate their own property (and, for Trial Balance/Documents, month+year) selector on the page itself. An accountant doing month-end close spends the entire session in one property/one period, so re-picking it on every page is friction and risks the three pages drifting out of sync. This change promotes property + period selection to a single global control in the header, next to the logo, so every scoped section (COA, Trial Balance, Documents) works within that one "workspace" without its own selector. Properties stays as-is (unscoped, shows all properties, is where new properties get created).

Confirmed with user:
- Selection **persists across sessions** (localStorage), so the accountant's workspace is still selected next time they log in.
- When there's no valid persisted selection, the period defaults to **last calendar month** (closed-period-first, matches month-end close workflow).

## Current state (relevant files)

- `ui/src/app/component/shell/shell.component.{ts,html,scss}` — the authenticated app shell/toolbar (logo, nav links, user menu). No selectors here today.
- `ui/src/app/app.routes.ts` — `ShellComponent` wraps all authenticated child routes (`/`, `/properties`, `/coa`, `/trial-balance`, `/documents`, `/extraction/:id`). No property/period route params anywhere.
- `ui/src/app/service/property.service.ts` — has **unused, dead** scaffolding: `_currentPropertyId` / `currentPropertyId` / `setCurrentProperty()`. Never read anywhere. Registered as a true app-wide singleton via `ServiceModule` → `importProvidersFrom` in `ui/src/app/app.config.ts`.
- `ui/src/app/component/trial-balance/trial-balance.component.{ts,html}` and `ui/src/app/component/document/document-list.component.{ts,html}` — near-identical duplicated property + month + year `mat-select`s, local `selectedPropertyId`/`selectedMonth`/`selectedYear` fields, a `period` getter (`'YYYY-MM'`), and `onSelectionChange()` that reloads page data.
- `ui/src/app/component/coa/coa-config.component.{ts,html}` — duplicates just the property selector (COA has no period concept — activation is property-scoped only).
- `ui/src/app/component/property/property-list.component.{ts,html}` — the unscoped Properties page; has the inline "Add a property" form (`createProperty()` → `propertyService.create()`).
- `ui/src/app/component/base.component.ts` / `ui/src/app/service/app.service.ts` — existing pub/sub pattern: `AppService` hosts an `EventQueue`; `BaseComponent.subscribeEvent()`/`notify()` is the idiomatic way components react to cross-cutting state changes (used today for `AlertEvent`, `ToggleSideNavEvent` in `ui/src/app/event/app.event.ts`). Auto-unsubscribes in `BaseComponent.ngOnDestroy`. This is the mechanism to use for "property/period changed" — no RxJS `BehaviorSubject`/signals are used elsewhere in this codebase, so don't introduce that pattern here.
- `ui/src/app/service/service.module.ts` — where all app-wide singleton services are registered.

## Design

### 1. New `WorkspaceService` (`ui/src/app/service/workspace.service.ts`)

Plain `@Injectable()` (not a `BaseService` — it doesn't call the API directly, it delegates to `PropertyService`). Registered in `ServiceModule`.

Holds:
- `properties: Property[]` — fetched once via `propertyService.getAll()`, shared by header + all scoped pages (removes 3x duplicate `getAll()` calls).
- `currentPropertyId: string`
- `currentPeriod: { month: number; year: number }` (mirrors the existing month/year fields pages already use; keep the `'YYYY-MM'` `period` getter here too since `TrialBalanceService`/`DocumentService` APIs take that string).

Behavior:
- `ready(): Promise<void>` — memoized init promise. Fetches properties, restores persisted `propertyId`/`period` from `localStorage` (plain `localStorage.getItem/setItem` with a small JSON blob — not the `Cache` utility, which is purpose-built for expiring API response caching, a poor fit for a durable preference). Falls back to the first property if the persisted id no longer exists, and to **last calendar month** if there's no valid persisted period.
- `setProperty(propertyId: string)` / `setPeriod(month: number, year: number)` — update state, persist to `localStorage`, and `appService.notify(new WorkspaceChangedEvent(...))`.
- `refreshProperties(): Promise<void>` — re-fetches `properties` (called by the Properties page after creating a property so the header list updates immediately without a manual reload).

### 2. New event — `ui/src/app/event/app.event.ts`

```ts
@AppEvent('Event.WorkspaceChanged')
export class WorkspaceChangedEvent extends BaseEvent<{ propertyId: string; period: string }> { }
```

### 3. Remove dead scaffolding

Delete `_currentPropertyId`/`currentPropertyId`/`setCurrentProperty()` from `PropertyService` — superseded by `WorkspaceService`. `PropertyService` goes back to being a pure API wrapper (`getAll`, `create`, `assignRole`).

### 4. Shared period constants

Extract the duplicated `months` array + `years` range (currently copy-pasted in `trial-balance.component.ts` and `document-list.component.ts`) into one shared location `WorkspaceService` (or a small `ui/src/app/utility/period.ts`) so there's one definition, used by the header and by `WorkspaceService.ready()`'s default-period logic.

### 5. `ShellComponent` — the new global selector UI

- Inject `WorkspaceService`, call `workspaceService.ready()` in `ngOnInit`, then `cdr.detectChanges()` (same await+detectChanges pattern already used in `TrialBalanceComponent`/`DocumentListComponent`/`CoaConfigComponent`).
- Add to `shell.component.html`, positioned right after `.brand` and before `.nav-links` (per the request — "to the right of the logo"):
  - A property `mat-select` (`appearance="outline"`, compact) bound to a local field that proxies `workspaceService.currentPropertyId`. Options are `workspaceService.properties`, plus a trailing sentinel option `+ Add new property`. On `(selectionChange)`: if the sentinel value was picked, reset the select back to the real current property and `appService.navigate({ path: 'properties' })`; otherwise `workspaceService.setProperty(value)`.
  - Month + year `mat-select`s (reusing the shared constants from #4), calling `workspaceService.setPeriod(month, year)` on change.
- Style additions in `shell.component.scss` for this toolbar segment — compact `mat-form-field`s sized to sit inline in the toolbar, consistent with the existing pill-shaped nav/user-menu aesthetic (dense outline appearance, no label wasted space — e.g. `subscriptSizing="dynamic"`).
- Empty state: if `workspaceService.properties.length === 0`, show a compact "Add a property" affordance in that toolbar slot instead of empty selects (links to `/properties`).

### 6. Scope COA / Trial Balance / Documents to the global workspace

For `CoaConfigComponent`, `TrialBalanceComponent`, `DocumentListComponent`:
- Remove local `properties`, `selectedPropertyId`, `months`, `years`, `selectedMonth`, `selectedYear`, `period` getter, and the corresponding `mat-select` markup block in each `.html` (Documents keeps its separate Document Type select — only the property/month/year selects go).
- Remove `onSelectionChange()` / `onPropertyChange()`; replace with `this.subscribeEvent(WorkspaceChangedEvent, () => this.loadX())` in `ngOnInit` (auto-unsubscribed by `BaseComponent`).
- `ngOnInit` becomes: `await this.workspaceService.ready(); this.subscribeEvent(WorkspaceChangedEvent, ...); await this.loadX();` — reading `workspaceService.currentPropertyId` / `workspaceService.currentPeriod.period` directly instead of local fields.
- Keep each page's existing empty-state message ("Add a property first…") but drive it off `workspaceService.properties.length === 0`.

### 7. Properties page

`PropertyListComponent` stays unscoped (shows all properties, unaffected by global selection) — no change to its own list/create/invite logic. Only addition: after a successful `createProperty()`, call `this.workspaceService.refreshProperties()` so the header selector picks up the new property immediately.

### 8. Home page

Left unscoped — it doesn't use property/period today and wasn't called out by the user.

## Verification

1. `cd ui && ng serve` + backend on 8080 (per `test/` E2E conventions in CLAUDE.md).
2. Log in, confirm the header shows property + month + year selectors next to the logo, defaulting to last calendar month.
3. Navigate Trial Balance → Chart of Accounts → Documents without touching the selectors — confirm all three show data for the same property/period, and none render their own selector anymore.
4. Change property/period from the header on one page, navigate to another — confirm the new page reflects the change (via the `WorkspaceChangedEvent` subscription) without a manual reload.
5. Reload the browser — confirm the previously selected property/period is restored from `localStorage`.
6. Pick "+ Add new property" from the header's property select — confirm it navigates to `/properties` and the select reverts to the real current property rather than sticking on the sentinel option.
7. Create a new property on `/properties` — confirm it appears in the header selector immediately.
8. Visit `/properties` — confirm it still lists **all** properties regardless of the global selection.
