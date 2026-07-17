# Plan: Domain 1 — Tenant / Property / Foundation

## Context

This is the foundation domain every other domain depends on. Multi-tenancy itself is **already implemented at the DI/database layer** (built by the user directly, ahead of this plan): `UserAuth` carries a `tenantId`; `Injector.get(cls, tenantId)` (`server/config/bootstrap.ts`) resolves a per-tenant `ReflectiveInjector` scope and sets `DeployConfig.INJECTED_TENANT_ID` right before constructing anything in that scope; `BaseRepository` (`server/repository/base.repository.ts`) picks that up in its constructor and hands it to `DatabaseContext`, whose `setTenant()` (`server/database/context.ts`) auto-stamps `tenantId` on every insert/update and auto-filters it into every find/count/sum/page/distinct query. **A plain `class FooRepository extends BaseRepository` is already tenant-isolated — no special base class, no header, no per-call `tenantId` argument.**

**Signup/tenant-creation flow (confirmed by the user):** there is no separate "create a tenant" step. A user signs up through the existing `POST /api/auth/create` endpoint; `AuthService` mints a fresh `tenantId` for that brand-new `UserAuth`, and a `Tenant` document is then created reactively using that same id. All *subsequent* users for that tenant are created only by an already-authenticated member of it (via the existing invite flow) — `AuthService`'s methods take the calling user's `tenantId` (when one is signed in) so new teammates land in the same tenant rather than minting their own. `AuthRepository` (`server/repository/auth.repository.ts`) is already constructed with `{ searchGlobalObjects: true }` specifically so username lookups at login work regardless of which tenant a user belongs to — this is existing, working code, not something this domain needs to touch.

What this domain actually builds: `Tenant`/`Property` models and CRUD, per-property role scoping (`PropertyRole` — a distinct concern from tenant *resolution*, since a user can hold different roles on different properties within their one tenant), Chart-of-Accounts template seeding, and per-property account activation. It also makes small, targeted changes to the existing `auth.service.ts`/`api.controller.ts` to thread `tenantId` through signup/invite.

**Demoable outcome:** sign up (which creates a tenant), add properties, invite a teammate into the same tenant, seed/configure a Chart of Accounts.

---

## Signup / tenant-creation flow

```
1. POST /api/auth/create  { username, password }   (no one signed in yet)
2. AuthService.register(...) has no calling-user tenantId available
   → mints a fresh tenantId = Common.uniqueId()
   → new UserAuth(username, hash, tenantId), flagged so the DB layer keeps this exact tenantId
     (see "the _tid escape hatch" below — otherwise the ambient '' scope would stamp tenantId: '' over it)
   → immediately creates a Tenant document using that same id (TenantService.createForSignup)
3. User is now signed in; their JWT/session carries that tenantId from here on
4. POST /api/auth/invite  { username: "teammate@x.com" }  (an authenticated tenant member)
   → AuthService.invite(username, invitedBy, callingUserTenantId) creates a *virtual* UserAuth
     with tenantId = callingUserTenantId (the inviter's own tenant — not a new one)
5. Invited teammate redeems the invite, sets a password via POST /api/auth/create — this request is
   already running inside a session tied to their (already correct, inviter's) tenantId, so no new
   tenantId is minted; the existing virtual UserAuth's tenantId is left untouched.
```

### The `_tid` escape hatch

`DatabaseContext.setTenant()` (`server/database/context.ts`) unconditionally overwrites `data._tid` with the *ambient* scope's tenant on every insert/update — **unless** `data._tid` is set, in which case it leaves the document's own `_tid` alone. An anonymous signup request runs in the default `''` scope (no session yet), so without this escape hatch the freshly-minted `tenantId` on the new `UserAuth` would be silently overwritten with `''`. `AuthService`'s brand-new-tenant branch must set `(newAuth as any)._tid = tenantId` before calling `authRepository.update(newAuth)`. The same flag is reused for the platform's global COA template rows (`tenantId` intentionally absent), described below.

---

## Files to Create

### 1. `model/tenant.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum TenantStatus { Active = 'active', Suspended = 'suspended' }

export class Tenant implements BaseModel {
    oid?: uniqueid;
    name: string;
    status: TenantStatus = TenantStatus.Active;
    createdAt: number;
}
```

### 2. `model/property.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum PropertyStatus { Active = 'active', Inactive = 'inactive' }

export class Property implements BaseModel {
    oid?: uniqueid;
    name: string;
    yardiCode?: string;      // e.g. 'pbnor001'
    address?: string;
    squareFootage?: number;
    status: PropertyStatus = PropertyStatus.Active;
    createdAt: number;
}

export enum PropertyRoleType { Accountant = 'accountant', Reviewer = 'reviewer', Admin = 'admin' }

export class PropertyRole implements BaseModel {
    oid?: uniqueid;
    userId: authid;
    propertyId?: uniqueid; // omitted = tenant-wide role (e.g. tenant Admin)
    role: PropertyRoleType;
    createdAt: number;
}
```

Neither model declares a `_tid` tenantId field — `DatabaseContext.setTenant()` stamps/filters it on the persisted document automatically; it isn't something service/controller code reads, sets, or passes around (mirroring how `_ts`/`_u`/`_tsu` audit fields aren't modeled on `BaseModel` either — they're persistence-layer concerns).

### 3. `model/chart-of-account.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum StatementType { BalanceSheet = 'balance_sheet', IncomeStatement = 'income_statement' }
export enum AccountSourceType { Yardi = 'yardi', Manual = 'manual' }

export class ChartOfAccount implements BaseModel {
    oid?: uniqueid;
    accountNumber: string;
    name: string;
    statementType: StatementType;
    category: string;             // e.g. 'Cash', 'AR', 'Fixed Assets'
    subCategory?: string;
    sourceType: AccountSourceType;
    isTemplate: boolean;          // true only on the platform starter-template rows
}

export class AccountActivation implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    accountId: uniqueid;          // ChartOfAccount.oid
    active: boolean;
}
```

### 4. `server/repository/tenant.repository.ts`

```typescript
@Injectable()
@Bootstrap()
export class TenantRepository extends BaseRepository {
    constructor() { super('tenant'); }

    getByOid(oid: uniqueid): Promise<Tenant> { return this.context.findOne({ oid }); }
    save(tenant: Tenant): Promise<Tenant> { return super.updateObject(tenant); }
}
```

`Tenant.oid` is a tenant's own primary identity, not something ever looked up *by* `tenantId` — whatever ambient `tenantId` happens to get auto-stamped onto a `Tenant` document (e.g. `''` when created during signup) is inconsequential.

### 5. `server/repository/property.repository.ts`

```typescript
@Injectable()
@Bootstrap()
export class PropertyRepository extends BaseRepository {
    constructor() { super('property'); }

    getAll(): Promise<Property[]> { return this.context.find({}); }
    getById(propertyId: uniqueid): Promise<Property> { return this.context.findOne({ oid: propertyId }); }
    save(property: Property): Promise<Property> { return super.updateObject(property); }
}
```

### 6. `server/repository/property-role.repository.ts`

Collection: `property_role`.

```typescript
@Injectable()
@Bootstrap()
export class PropertyRoleRepository extends BaseRepository {
    constructor() { super('property_role'); }

    getByUser(userId: authid): Promise<PropertyRole[]> { return this.context.find({ userId }); }
    save(role: PropertyRole): Promise<PropertyRole> { return super.updateObject(role); }
}
```

Purely for per-property *authorization* (does this user have a role on property X — consumed by `AuthorizationService`/the `@Auth` decorator). It plays no role in tenant resolution, which is automatic.

### 7. `server/repository/chart-of-account.repository.ts`

Collection: `chart_of_account`. This is the one repository in this domain that legitimately needs cross-tenant visibility, to read the platform's starter template (which has no tenant of its own):

```typescript
@Injectable()
@Bootstrap()
export class ChartOfAccountRepository extends BaseRepository {
    constructor() { super('chart_of_account', { searchGlobalObjects: true }); }

    getTemplate(): Promise<ChartOfAccount[]> { return this.context.find({ isTemplate: true }); }
    getByTenant(): Promise<ChartOfAccount[]> { return this.context.find({ isTemplate: false }); }
    save(account: ChartOfAccount): Promise<ChartOfAccount> { return super.updateObject(account); }
}
```

With `searchGlobalObjects: true`, `DatabaseContext.setTenant()` turns any read into `$or: [{ _tid: <current tenant> }, { _tid: null }]` — combined with the explicit `isTemplate` filter, `getTemplate()` correctly returns only the null-tenant template rows and `getByTenant()` only the current tenant's own seeded rows, without either method needing to reference tenancy directly. Mirrors exactly how `AuthRepository` already uses `searchGlobalObjects: true` for tenant-agnostic username lookups; `RepositoryOptions.searchGlobalObjects` already forwards through to `contextOptions` (`server/repository/base.repository.ts`), so `ChartOfAccountRepository` just needs to pass it in its `super()` call like `AuthRepository` does.

Seeding a template row (`isTemplate: true`) uses the same `_tid: tenantId` escape hatch described above, since a template row has no tenant at all — not even the current one.

### 8. `server/repository/account-activation.repository.ts`

Collection: `account_activation`.

```typescript
@Injectable()
@Bootstrap()
export class AccountActivationRepository extends BaseRepository {
    constructor() { super('account_activation'); }

    getByProperty(propertyId: uniqueid): Promise<AccountActivation[]> { return this.context.find({ propertyId }); }
    save(activation: AccountActivation): Promise<AccountActivation> { return super.updateObject(activation); }
}
```

### 9. `server/service/tenant.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class TenantService extends BaseService {
    constructor(appService: AppService, private tenantRepository: TenantRepository, private chartOfAccountService: ChartOfAccountService) {
        super(appService);
    }

    // called from AuthService immediately after a brand-new UserAuth/tenantId is persisted
    async createForSignup(tenantId: uniqueid, name: string): Promise<Tenant> {
        const tenant = new Tenant();
        tenant.oid = tenantId; // the Tenant's own identity *is* the tenantId just minted for the signing-up user
        tenant.name = name;
        tenant.createdAt = Date.now();

        await this.tenantRepository.save(tenant);
        await this.chartOfAccountService.seedTemplate();
        return tenant;
    }

    getCurrent(tenantId: uniqueid): Promise<ApiResponse<Tenant>> {
        return this.tenantRepository.getByOid(tenantId).then(t => t ? new ApiResponse(true, t) : new ApiErrorResponse('tenant not found'));
    }
}
```

### 10. `server/service/property.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class PropertyService extends BaseService {
    constructor(appService: AppService, private propertyRepository: PropertyRepository, private propertyRoleRepository: PropertyRoleRepository) {
        super(appService);
    }

    async create(name: string, yardiCode?: string): Promise<ApiResponse<Property>> {
        const property = new Property();
        property.oid = UniqueId(Common.uniqueId());
        property.name = name;
        property.yardiCode = yardiCode;
        property.createdAt = Date.now();

        await this.propertyRepository.save(property);
        return new ApiResponse(true, property);
    }

    getAll(): Promise<Property[]> { return this.propertyRepository.getAll(); }

    async assignRole(propertyId: uniqueid, userId: authid, role: PropertyRoleType): Promise<ApiResponse<PropertyRole>> {
        const propertyRole = new PropertyRole();
        propertyRole.oid = UniqueId(Common.uniqueId());
        propertyRole.propertyId = propertyId;
        propertyRole.userId = userId;
        propertyRole.role = role;
        propertyRole.createdAt = Date.now();

        await this.propertyRoleRepository.save(propertyRole);
        return new ApiResponse(true, propertyRole);
    }
}
```

### 11. `server/service/chart-of-account.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class ChartOfAccountService extends BaseService {
    constructor(appService: AppService, private chartOfAccountRepository: ChartOfAccountRepository, private accountActivationRepository: AccountActivationRepository) {
        super(appService);
    }

    async seedTemplate(): Promise<void> {
        const template = await this.chartOfAccountRepository.getTemplate();
        for (const templateAccount of template) {
            const account = { ...templateAccount, oid: UniqueId(Common.uniqueId()), isTemplate: false };
            await this.chartOfAccountRepository.save(account);
        }
    }

    getByTenant(): Promise<ChartOfAccount[]> { return this.chartOfAccountRepository.getByTenant(); }

    async activate(propertyId: uniqueid, accountId: uniqueid, active: boolean): Promise<ApiResponse<AccountActivation>> {
        const activation = new AccountActivation();
        activation.oid = UniqueId(Common.uniqueId());
        activation.propertyId = propertyId;
        activation.accountId = accountId;
        activation.active = active;

        await this.accountActivationRepository.save(activation);
        return new ApiResponse(true, activation);
    }

    getActivations(propertyId: uniqueid): Promise<AccountActivation[]> {
        return this.accountActivationRepository.getByProperty(propertyId);
    }
}
```

*`seedTemplate()` runs from `TenantService.createForSignup`, which executes inside the same request/injector scope as the just-created `UserAuth` (the anonymous `''` scope) — the newly-seeded per-tenant COA rows (`isTemplate: false`, real account data) get auto-stamped with whatever `tenantId` is ambient there. Since signup's `_tid: tenantId` trick only applies to the `UserAuth` document itself, the COA-seeding step needs the same treatment: either run it through `Injector.get(ChartOfAccountService, tenant.oid)` explicitly, or set `_tid: tenantId` on each seeded account before save. Flagging this as an implementation detail to settle when this domain is built, not a blocker to the plan.*

### 12. `server/controller/tenant.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class TenantController extends BaseController {
    constructor(private tenantService: TenantService) { super(); }

    async init(_req: Request) {}

    @Get('')
    async getCurrent(req: Request, res: Response) {
        const data = await this.tenantService.getCurrent(req.session.tenantId);
        res.send(data);
    }
}
```

No signup endpoint here — signup happens through the existing `POST /api/auth/create`, modified below.

### 13. `server/controller/property.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class PropertyController extends BaseController {
    constructor(private propertyService: PropertyService) { super(); }

    async init(_req: Request) {}

    @Post('')
    async create(req: Request, res: Response) {
        const { name, yardiCode } = req.body;
        if (!name) return this.sendError(res, 'name is required');
        const data = await this.propertyService.create(name, yardiCode);
        res.send(data);
    }

    @Get('')
    async getAll(_req: Request, res: Response) {
        const data = await this.propertyService.getAll();
        this.sendSuccess(res, data);
    }

    @Post(':id/role')
    async assignRole(req: Request, res: Response) {
        const { userId, role } = req.body;
        if (!userId || !role) return this.sendError(res, 'userId and role are required');
        const data = await this.propertyService.assignRole(UniqueId(req.query.id), AuthId(userId), role);
        res.send(data);
    }
}
```

No tenant plumbing anywhere in this controller — `req.session.tenantId` already determined which `PropertyRepository` instance backs this request before the handler runs.

### 14. `server/controller/coa.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class CoaController extends BaseController {
    constructor(private chartOfAccountService: ChartOfAccountService) { super(); }

    async init(_req: Request) {}

    @Get('')
    async getAll(_req: Request, res: Response) {
        const data = await this.chartOfAccountService.getByTenant();
        this.sendSuccess(res, data);
    }

    @Post('activation')
    async setActivation(req: Request, res: Response) {
        const { propertyId, accountId, active } = req.body;
        const data = await this.chartOfAccountService.activate(UniqueId(propertyId), UniqueId(accountId), active);
        res.send(data);
    }

    @Get('activation/:propertyId')
    async getActivations(req: Request, res: Response) {
        const data = await this.chartOfAccountService.getActivations(UniqueId(req.query.propertyId));
        this.sendSuccess(res, data);
    }
}
```

---

## Files to Modify

### `server/service/auth.service.ts` — thread `tenantId` through signup/invite

```typescript
private async register(auth: UserAuth, username: string, password: string, tenantId?: string) {
    if (!auth || auth.virtual) {
        if (PasswordUtility.isPasswordSecure(password)) {
            return this.persistAuth(username, password, tenantId);
        }
        return new ApiResponse(false, null, PasswordUtility.insecurePasswordMessage(password));
    }
    return new ApiResponse(false, null, 'the user already exists');
}

private async persistAuth(username: string, password: string, tenantId?: string) {
    const hash = await bcrypt.hash(password, this.saltRounds);
    const existingAuth = await this.authRepository.getByUsernameWithCredentials(username);

    let auth: UserAuth;
    if (existingAuth) {
        existingAuth.password = hash;
        delete existingAuth.virtual;
        auth = await this.authRepository.update(existingAuth); // tenantId untouched — already set at invite time
    }
    else {
        const isNewTenant = !tenantId;
        tenantId = tenantId || Common.uniqueId();

        const newAuth = new UserAuth(username, hash, tenantId);
        if (isNewTenant) {
            (newAuth as any)._tid = tenantId; // bypass the ambient '' scope's auto-stamp so this tenantId sticks
        }
        auth = await this.authRepository.update(newAuth);

        if (isNewTenant) {
            await this.tenantService.createForSignup(tenantId, username); // default tenant name; renamed later via TenantController
        }
    }

    delete auth.password;
    return new ApiResponse(true, auth);
}

async invite(username: string, invitedBy: string, tenantId: string): Promise<ApiResponse<{ oid: string }>> {
    const auth = await this.authRepository.getByUsername(username);
    if (auth && !auth.virtual) {
        return new ApiResponse(false, null, 'user already exists');
    }

    let userAuth: UserAuth;
    if (!auth) {
        userAuth = new UserAuth(username, '', tenantId); // the inviter's own tenant, not a new one
        userAuth.virtual = true;
        await this.authRepository.update(userAuth);
    } else {
        userAuth = auth;
    }
    // ... unchanged invite-code/email logic below
}
```

`register`/`persistAuth` gain an optional `tenantId` — present when an authenticated caller is creating a teammate (though today only `invite()`'s redemption flow reaches `register`, always pre-scoped correctly by session; direct admin-created users would also pass it), absent for a brand-new anonymous signup. `TenantService` becomes a new constructor dependency of `AuthService`.

### `server/controller/api.controller.ts` — pass `req.session.tenantId` through

```typescript
private async completeAuthentication(req: Request, res: Response, username: string, password: string, create: boolean, bypassPassword: boolean) {
    const data = await this.authService.authenticate(username, password, create, bypassPassword, req.session.tenantId);
    ...
}

@Post('auth/invite')
async invite(req: Request, res: Response) {
    const { username } = req.body;
    if (!username) return this.sendError(res, 'username is required');
    const data = await this.authService.invite(username, req.session.user.oid, req.session.tenantId);
    res.send(data);
}
```

`AuthService.authenticate(username, password, create?, bypassPassword?, tenantId?)` forwards `tenantId` into `register(auth, username, password, tenantId)`.

### `server/router/router.ts` — register the new controllers

```typescript
export class Router extends BaseRouter {
    init() {
        let routes: RouteInfo[] = [
            { path: `${this.getBaseUrl()}`, controller: APIController },
            { path: `${this.getBaseUrl()}/tenant`, controller: TenantController },
            { path: `${this.getBaseUrl()}/property`, controller: PropertyController },
            { path: `${this.getBaseUrl()}/coa`, controller: CoaController },
        ];
        if (!Config.SERVERLESS) {
            routes = routes.concat([{ path: '*', controller: StaticController }]);
        }
        return routes;
    }
}
```

### Platform COA template seed data

A one-time seed script (`server/jobs/seed-coa-template.job.ts`, run via `ts-node` like `onboard.job.ts`) inserts the ~666-account portfolio-wide COA template rows (`isTemplate: true`, `_tid: tenantId`) discovered during the Vanderbilt file review. Not a live HTTP endpoint — a deployment-time data load.

---

## Angular

No `CLIENT-ID` header, no tenant-switcher UI — a `UserAuth` belongs to exactly one tenant, carried transparently by the existing `Authorization` bearer token. The only client-side "switcher" needed is for **properties** within that one tenant.

### `ui/src/app/service/property.service.ts`

```typescript
@Injectable()
export class PropertyService extends BaseService {
    private _currentPropertyId: string;

    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    get currentPropertyId(): string { return this._currentPropertyId; }
    setCurrentProperty(propertyId: string) { this._currentPropertyId = propertyId; }

    getAll(): Promise<ApiResponse<Property[]>> { return this.get('property'); }
    create(name: string, yardiCode?: string): Promise<ApiResponse<Property>> { return this.post('property', { name, yardiCode }); }
}
```

### Components

- Signup form reuses the existing auth component (`POST /api/auth/create`) — no separate "tenant signup" UI, since signup itself *is* tenant creation now.
- `PropertySwitcherComponent` — dropdown in the app shell for users with roles on multiple properties.
- `PropertyListComponent`, `CoaConfigComponent` (per-property account activation toggles).
- An "Organization Settings" view calling `GET /api/tenant` to show/rename the tenant (`Tenant.name` defaults to the signing-up user's username until renamed).

Routes in `ui/src/app/app.routes.ts`:

```typescript
{ path: 'properties', component: PropertyListComponent },
{ path: 'coa', component: CoaConfigComponent },
```

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `@Injectable() @Bootstrap()` on repo/service/controller | every existing file, e.g. `server/repository/invite.repository.ts` |
| Automatic tenant scoping via `DeployConfig.INJECTED_TENANT_ID` + `DatabaseContext.setTenant()` | `server/repository/base.repository.ts`, `server/database/context.ts` |
| `searchGlobalObjects: true` for tenant-agnostic lookups | `server/repository/auth.repository.ts` (already does this for login) |
| `context.update(query, obj, null, { upsert: true })` via `updateObject` | `server/repository/base.repository.ts:69` |
| Controller route registration via `RouteInfo[]` | `server/router/router.ts` |
| `UniqueId`/`AuthId` branded-ID helpers | `model/id.model.ts` |
| Existing invite flow (`invite`/`redeemInviteCode`) | `server/service/auth.service.ts`, `.claude/plans/invite-user.md` |
| Angular `BaseService.post/get` | `ui/src/app/service/auth.service.ts` |

## Verification

1. `POST /api/auth/create` `{ username: "admin@vanderbilt.com", password: "..." }` (no one signed in) → confirm a `UserAuth` is created with a real (non-empty) `tenantId`, and a matching `Tenant` document exists with `oid` equal to that same `tenantId`.
2. Log in as that user, `POST /api/property` `{ name: "Northbridge Centre", yardiCode: "pbnor001" }` → confirm the property is persisted and auto-stamped with the caller's `tenantId`.
3. `POST /api/auth/invite` `{ username: "teammate@vanderbilt.com" }` as the logged-in admin, then complete registration via `POST /api/auth/create` for that teammate → confirm the teammate's `UserAuth.tenantId` matches the *inviter's* tenantId (not a freshly-minted one).
4. `POST /api/property/:id/role` assigning `{ userId, role: 'accountant' }` to the teammate → confirm `property_role` document created, and the teammate's `GET /api/property` shows Northbridge Centre (same tenant).
5. Sign up a **second**, unrelated user via `POST /api/auth/create` (fresh tenant) → `GET /api/property` for that user → confirm **zero** properties returned (not Northbridge Centre) — proving isolation is automatic, with no explicit tenant filtering written anywhere in `PropertyRepository`.
6. `GET /api/coa` for each tenant → confirm each only sees its own seeded working COA (`isTemplate: false`), never the other tenant's rows nor the raw template rows.
7. Directly inspect the `chart_of_account` collection in Mongo → confirm template rows (`isTemplate: true`) carry no real `tenantId` and are not returned by `GET /api/coa` for any tenant.
