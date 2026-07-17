# Move header nav into a collapsible mat-sidenav

## Context

The `ShellComponent` header (`ui/src/app/component/shell/shell.component.html`) currently packs a logo, property selector, date selector, and 9 horizontal nav links (`Home`, `Properties`, `Chart of Accounts`, `Trial Balance`, `Documents`, `Reconciliation`, `Checklist`, `Review`, `Period Close`) into one `mat-toolbar`. It's visually cluttered. We're moving all nav links except Home into a proper Angular Material side nav (`mat-sidenav`) that lives below the header (header stays pinned/full-width, never overlapped) and can collapse to icon-only or expand to icon+label. Home stays in the header as an icon-only link. The header gains a toggle button to collapse/expand the sidenav.

## Current structure (confirmed by reading the files)

- `shell.component.html` — single `mat-toolbar` containing: brand, workspace pills (property + period selectors via `mat-menu`), `<nav class="nav-links">` (9 `routerLink` anchors with `routerLinkActive="active-link"`), spacer, user menu. Below the toolbar: `<main class="shell-content"><router-outlet /></main>`.
- `shell.component.ts` — standalone component (Angular 22, `imports: [...]` array), currently imports `MatToolbarModule`, `MatIconModule`, `MatMenuModule`, `MatDividerModule`. No `MatSidenavModule`/`MatListModule`/`MatButtonModule`/`MatTooltipModule` anywhere in the app yet — all fresh additions, but `@angular/material` (`^22.0.5`) is a direct dependency and `@angular/cdk` is present transitively, so no package.json change is needed.
- `shell.component.scss` — `.shell-toolbar` is `position: sticky; top: 0; z-index: 10`. `.nav-link` / `.active-link` use pill styling with `color-mix(in srgb, var(--mat-sys-primary) 12%, transparent)` for the active state — this is the visual language to carry into the sidenav's active item state. `.shell-content` is `padding: 2rem 1.5rem; max-width: 1100px; margin: 0 auto;`. No existing `@media`/responsive/collapse CSS anywhere in this file — collapse behavior is new.
- Route map (`ui/src/app/app.routes.ts`), used to build the nav item list:

| Label | Path |
|---|---|
| Properties | `/properties` |
| Chart of Accounts | `/coa` |
| Trial Balance | `/trial-balance` |
| Documents | `/documents` |
| Reconciliation | `/reconciliation` |
| Checklist | `/checklist` |
| Review | `/review` |
| Period Close | `/period` |

- Icon conventions: app loads Material Icons font globally (`ui/src/index.html`), icons referenced by snake_case ligature name directly in `<mat-icon>`, no SVG registration. `apartment` is already used for Properties (workspace pill) — reuse it for consistency.

## Implementation

### 1. `shell.component.ts`
- Add imports: `MatSidenavModule` (`@angular/material/sidenav`), `MatListModule` (`@angular/material/list`), `MatButtonModule` (`@angular/material/button`), `MatTooltipModule` (`@angular/material/tooltip`).
- Add `sidenavExpanded = true;` (default expanded) and a `toggleSidenav()` method that flips it.
- Add a `navItems` array (label, path, icon) driving the sidenav with `@for`, replacing the 8 hardcoded anchors:
  - Properties → `apartment` (matches existing workspace-pill icon)
  - Chart of Accounts → `account_tree`
  - Trial Balance → `account_balance`
  - Documents → `description`
  - Reconciliation → `sync_alt`
  - Checklist → `playlist_add_check`
  - Review → `rate_review`
  - Period Close → `lock`

### 2. `shell.component.html`
- In the toolbar: add a leading `mat-icon-button` (icon `menu`) calling `toggleSidenav()`, before `.brand`.
- Remove the `<nav class="nav-links">…</nav>` block (lines 69-79) entirely.
- In its place (after the workspace pills, before the spacer), add a single icon-only Home link: `<a mat-icon-button class="home-link" routerLink="/" routerLinkActive="active-icon-link" [routerLinkActiveOptions]="{ exact: true }" aria-label="Home"><mat-icon>home</mat-icon></a>`.
- Replace `<main class="shell-content"><router-outlet /></main>` with:
```html
<mat-sidenav-container class="shell-body">
    <mat-sidenav mode="side" opened class="app-sidenav" [class.collapsed]="!sidenavExpanded">
        <mat-nav-list>
            @for (item of navItems; track item.path) {
                <a mat-list-item class="side-nav-item" [routerLink]="item.path" routerLinkActive="active-nav-item"
                   [matTooltip]="sidenavExpanded ? '' : item.label" matTooltipPosition="right">
                    <mat-icon class="side-nav-icon">{{ item.icon }}</mat-icon>
                    <span class="side-nav-label">{{ item.label }}</span>
                </a>
            }
        </mat-nav-list>
    </mat-sidenav>
    <mat-sidenav-content class="shell-content">
        <router-outlet />
    </mat-sidenav-content>
</mat-sidenav-container>
```
  Sidenav stays permanently `opened` (never hides) — only its width/label-visibility toggles between collapsed (icon-only) and expanded (icon+text), per the request.

### 3. `shell.component.scss`
- Change `:host` to a column flex layout so the toolbar keeps its natural height and `.shell-body` fills the rest of the viewport: `display: flex; flex-direction: column; min-height: 100vh;`.
- Add `.shell-body { flex: 1 1 auto; }` (mat-sidenav-container needs a resolvable height — flex-grow inside the column host provides it).
- Add `.app-sidenav` styling: fixed `width: 240px`, `transition: width 0.2s ease`, `overflow-x: hidden`, subtle right border (`border-right: 1px solid var(--mat-sys-outline-variant)`), white background. Add `.app-sidenav.collapsed { width: 64px; }`.
- `.side-nav-item`: flex row, icon + label, consistent height (~48px), horizontal padding.
- `.side-nav-label`: hidden via `.app-sidenav.collapsed .side-nav-label { display: none; }`.
- `.active-nav-item`: reuse the existing active-pill visual language (`color-mix(in srgb, var(--mat-sys-primary) 12%, transparent)` background, `var(--mat-sys-primary)` text, `font-weight: 700`) adapted to the list-item shape.
- `.home-link` / `.active-icon-link`: small icon-button styling consistent with `.nav-link`/`.active-link`'s hover/active treatment, sized like the other toolbar icon buttons.
- Remove now-unused `.nav-links` / `.nav-link` / `.active-link` rules (superseded by the sidenav classes and the new `.home-link`/`.active-icon-link`).
- `.shell-content` keeps its existing padding/max-width/margin rules (now applied inside `mat-sidenav-content` instead of `<main>`).

## Verification
- Run the app (`ng serve` per the E2E testing setup) and visually check: header no longer shows the 9-link nav, shows the menu toggle + Home icon; sidenav appears below the header with icons for all 8 remaining sections; clicking the toggle collapses/expands the sidenav (icon-only ↔ icon+label) with a smooth width transition; header remains fully visible/un-overlapped in both states.
- Click each sidenav item and confirm it navigates to the correct route and highlights as active; confirm Home highlights only on the exact `/` route.
- Check collapsed-state tooltips appear on hover over each icon.
- Run `cd server && npx tsc -p tsconfig.json` equivalent Angular build (`ng build` or existing lint/build step) to confirm no compile errors from the new Material module imports.
