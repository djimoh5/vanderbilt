# Plan: Domain 0 — Login Screen

## Context

The backend auth surface is already fully built and covered by prior plans: `POST /api/auth` (login/resume), `POST /api/auth/create` (register — now also the tenant-signup entry point per Domain 1), `POST /api/auth/code/request` / `/verify` (passwordless OTP login, `.claude/plans/one-time-code-login.md`), `POST /api/auth/password/reset` / `/confirm` (`.claude/plans/forgot-password.md` — explicitly scoped as "frontend out of scope"). The Angular `AuthService` (`ui/src/app/service/auth.service.ts`) already wraps most of these (`authenticate`, `create`, `requestLoginCode`, `verifyLoginCode`).

None of it has a screen. `ui/src/app/component/` only contains `HomeComponent`, and `app.routes.ts` has a dead, commented-out reference to a nonexistent `app/auth` guard — there's no route protection at all today, and no way for a user to actually reach the login form. **This domain is Angular-only** — no backend changes, no new server endpoints. It's a prerequisite for every other domain's UI (a user has to be able to log in before any tenant/property screen means anything), hence the `00-` prefix.

One model wrinkle to account for: the shared `UserAuth` class (`model/auth.model.ts`, re-exported into the Angular app via `bundle/model` from the same monorepo `model/` package — Angular imports the literal same class the server uses) now requires `tenantId` in its constructor, per Domain 1's tenancy work. Login doesn't need one (the server resolves the user via `AuthRepository`'s tenant-agnostic lookup regardless of what's sent); a fresh signup constructs `new UserAuth(username, password, '')` and lets the server mint the real tenantId, exactly as Domain 1 describes.

**Demoable outcome:** a user with no session is redirected to `/login`; they can log in, sign up (creating a tenant per Domain 1), recover a forgotten password, or log in via emailed code — landing back in the app with a working session that survives a page reload.

---

## Files to Create

### 1. `ui/src/app/component/login/login.component.ts` (+ `.html`/`.scss`)

```typescript
@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent extends BaseComponent implements OnInit {
    username = '';
    password = '';
    mode: 'login' | 'signup' = 'login';
    error: string;

    constructor(appService: AppService, private authService: AuthService) { super(appService); }

    ngOnInit(): void {}

    async submit() {
        this.error = null;
        const res = this.mode === 'login'
            ? await this.authService.authenticate({ username: this.username, password: this.password } as UserAuth)
            : await this.authService.create(new UserAuth(this.username, this.password, ''));

        if (res.success) {
            this.appService.navigate({ path: '' });
        } else {
            this.error = res.msg;
        }
    }

    toggleMode() {
        this.mode = this.mode === 'login' ? 'signup' : 'login';
        this.error = null;
    }
}
```

Template: username/password fields, submit button, a small "Create account" / "Back to login" toggle link, and links to `/login/code` and `/password/reset`. Error message rendered from `error`.

### 2. `ui/src/app/component/login/one-time-code.component.ts`

Two-step form:
- Step 1 — email input, `authService.requestLoginCode(username)`. Always shows the same generic "if an account exists, a code has been sent" message (matches the backend's anti-enumeration response) and advances to step 2 regardless of whether the account exists.
- Step 2 — code input, `authService.verifyLoginCode(username, code)` → on success, `appService.navigate({ path: '' })`.

### 3. `ui/src/app/component/login/forgot-password.component.ts`

Same two-step shape as above:
- Step 1 — `authService.requestPasswordReset(username)` (new wrapper, see below).
- Step 2 — code + new password, `authService.confirmPasswordReset(username, code, newPassword)` (new wrapper) → on success, navigate to `/login` with a "password updated, log in" message (no session is started by this endpoint, matching the backend plan's explicit behavior).

### 4. `ui/src/app/guard/auth.guard.ts`

```typescript
export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated) {
        return true;
    }

    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

---

## Files to Modify

### `ui/src/app/service/auth.service.ts`

Add an authenticated-state getter and a session-resume method, plus the two missing password-reset wrappers (the backend endpoints already exist per `.claude/plans/forgot-password.md`; the Angular service just never wrapped them):

```typescript
get isAuthenticated(): boolean { return !!this._userAuth?.token || !!this.apiService.AuthorizationHeader[UserHeaderKey.Authorization]; }

async resume(): Promise<boolean> {
    // no-args call — server resumes via the stored Authorization header token, same as api.controller.ts's
    // existing `if (req.session.user && req.session.user.token)` branch
    const res = await this.authenticate();
    return res.success;
}

async requestPasswordReset(username: string): Promise<ApiResponse<null>> {
    return this.post('auth/password/reset', { username });
}

async confirmPasswordReset(username: string, code: string, newPassword: string): Promise<ApiResponse<null>> {
    return this.post('auth/password/reset/confirm', { username, code, newPassword });
}
```

### `ui/src/app/app.ts` (root component)

```typescript
export class App implements OnInit {
    ready = signal(false);

    constructor(private authService: AuthService) {}

    async ngOnInit() {
        await this.authService.resume(); // silently restores a valid stored session before any route/guard evaluates
        this.ready.set(true);
    }
}
```

`app.html` gates `<router-outlet>` behind `@if (ready())` so the guard never runs against a not-yet-resumed auth state (avoiding a flash-redirect-to-login on a hard page reload with a valid token still in `Cache`).

### `ui/src/app/app.routes.ts`

```typescript
export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'login/code', component: OneTimeCodeComponent },
    { path: 'password/reset', component: ForgotPasswordComponent },

    { path: '', component: HomeComponent, canActivate: [authGuard] },
    { path: '**', component: HomeComponent, canActivate: [authGuard] }
];
```

Every route Domains 1–9 add (`properties`, `checklist/:propertyId/:period`, etc.) gets `canActivate: [authGuard]` too.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `AuthService.authenticate()`/`create()`/`requestLoginCode()`/`verifyLoginCode()` — all pre-existing | `ui/src/app/service/auth.service.ts` |
| `AuthService.processResponse()` already sets the token via `apiService.setToken()` on any successful auth call | `ui/src/app/service/auth.service.ts` |
| Existing 401 handling — clears token, fires `AlertEvent` | `ui/src/app/service/base.service.ts:166-192` (`processError`) |
| `BaseComponent`/`AppService.navigate` | `ui/src/app/component/base.component.ts`, `ui/src/app/component/home/home.component.ts` |
| Functional `CanActivateFn` guard style (modern standalone-component Angular, matches `app.ts`'s standalone `App` component) | `ui/src/app/app.ts`, `ui/src/app/app.routes.ts` |
| Backend endpoints — no changes needed, all already built | `server/controller/api.controller.ts`, `.claude/plans/one-time-code-login.md`, `.claude/plans/forgot-password.md` |

## Verification

1. Fresh browser, no stored token: visit `/` → redirected to `/login?returnUrl=%2F`.
2. Log in with valid credentials → redirected back to `/`, subsequent API calls carry the `Authorization` header (via the existing `ApiTokenService`/`Cache` plumbing).
3. Log in with bad credentials → inline error, no navigation, no token set.
4. Toggle to "Create account", sign up a new username → succeeds, lands on `/` (this is Domain 1's tenant-signup flow — verify a new `Tenant`/`UserAuth` pair as described there).
5. `/login/code` → request a code, verify it → session starts identically to password login.
6. `/password/reset` → request a reset code, confirm with code + new password → redirected to `/login` with a confirmation message; log in with the **old** password fails, with the **new** password succeeds.
7. After a successful login, reload the page → `resume()` silently restores the session (no visible redirect to `/login`), confirming the `Cache`-stored token round-trips correctly.
8. Manually clear the stored token (or let a 401 fire) → next navigation redirects to `/login` via the guard.
