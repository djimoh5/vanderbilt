# Plan: Invite Feature API

## Context

Add an invite flow so authenticated users can invite new people by email. An invited user is stored as a "virtual" `UserAuth` (marked with `virtual: true`) until they complete registration. Invite metadata (the one-time code, expiry, and who sent the invite) lives in a separate `invite` collection rather than on the `UserAuth` document. The invite email contains a magic link with a one-time code. Clicking the link lets the frontend auto-log the user in via the API. On registration, the virtual flag is stripped and the account becomes a full user.

Login and registration are modified to be aware of virtual users: login rejects them (they have no real password), and registration converts them rather than blocking as a duplicate.

---

## Files Modified

| File | Change |
|------|--------|
| `model/auth.model.ts` | Added `virtual?` to `UserAuth` |
| `model/invite.model.ts` | **New** — `Invite` class with `oid`, `username`, `inviteCode`, `inviteExpiry`, `invitedBy` |
| `server/config/config.base.ts` | Added `APP_URL: string = ''` for magic link base URL |
| `server/repository/auth.repository.ts` | No invite logic — clean |
| `server/repository/invite.repository.ts` | **New** — `InviteRepository` on the `invite` collection |
| `server/service/auth.service.ts` | Added `invite()`, `redeemInviteCode()`; modified `login()`, `register()`, `persistAuth()` |
| `server/controller/api.controller.ts` | Added `POST /auth/invite` and `POST /auth/invite/redeem` endpoints |

---

## Detailed Design

### `model/auth.model.ts`

`UserAuth` has one new optional field:

```typescript
virtual?: boolean;   // true = invited but not yet registered
```

Invite codes and expiry are **not** stored here — they live in the `invite` collection.

### `model/invite.model.ts`

```typescript
export class Invite {
    oid: uniqueid;
    constructor(
        public username: string,
        public inviteCode: string,
        public inviteExpiry: number,  // Unix ms, 7 days from creation
        public invitedBy: string      // oid of the authenticated user who sent the invite
    ) { ... }
}
```

### `server/config/config.base.ts`

```typescript
static APP_URL = '';   // override per env (e.g. 'https://app.example.com')
```

### `server/repository/invite.repository.ts`

MongoDB collection: `invite`. Auto-registered via `@Bootstrap()`.

```typescript
getByCode(code: string): Promise<Invite>       // lookup by inviteCode
getByUsername(username: string): Promise<Invite> // lookup by invited email
save(invite: Invite): Promise<Invite>           // upsert on oid
```

### `server/service/auth.service.ts`

**Constructor**: injects `AppService`, `AuthRepository`, `InviteRepository`, `LoginCodeRepository`, `EmailService`.

**`invite(username, invitedBy)`**:
- If real (non-virtual) user exists → `ApiResponse(false, null, 'user already exists')`
- If no `UserAuth` exists → create one with `virtual = true`
- Generate `inviteCode = Common.uniqueId()`; `inviteExpiry = now + 7d`
- Upsert an `Invite` record (reuses existing record if already invited, updating code + expiry + invitedBy)
- Send email with link `${Config.APP_URL}/invite?code=<inviteCode>` using `invitedBy` as the audit user id
- Return `ApiResponse(true, null)`

**`redeemInviteCode(code)`**:
- Look up `Invite` by code via `inviteRepository.getByCode(code)`
- If not found → `ApiResponse(false, null, 'invalid invite code')`
- If expired → `ApiResponse(false, null, 'invite code has expired')`
- Fetch the virtual `UserAuth` by `invite.username`
- If user not found or not virtual (already registered) → `ApiResponse(false, null, 'invalid invite code')`
- Return `ApiResponse(true, auth)` — caller starts a session

**`login(auth, password, bypassPassword?)`** (private):
- Added: if `auth.virtual` → return `'username or password incorrect'` (virtual users cannot log in with a password)

**`register(auth, username, password)`** (private):
- Condition changed from `!auth` to `!auth || auth.virtual` — allows virtual users to proceed to registration
- Passes existing virtual `UserAuth` to `persistAuth` for in-place conversion

**`persistAuth(username, password, existingAuth?)`** (private):
- If `existingAuth` provided: sets hashed password, deletes `virtual`, saves in place (preserving `oid`)
- Otherwise: creates a fresh `UserAuth`

### `server/controller/api.controller.ts`

**`POST /auth/invite`** — requires auth (no `@NoAuth()`):
```typescript
const data = await this.authService.invite(username, req.session.user.oid);
```

**`POST /auth/invite/redeem`** — public (`@NoAuth()`):
```typescript
const data = await this.authService.redeemInviteCode(code);
if (data.success) {
    req.session.user = data.data;
    await this.init(req);
    req.session.start(data.data);
}
```

---

## Magic Link Flow

```
1. Authenticated user  →  POST /api/auth/invite  { username: "new@example.com" }
2. Virtual UserAuth created in agent_auth (virtual=true)
3. Invite record created in invite collection (inviteCode, inviteExpiry, invitedBy)
4. Email sent with link: <APP_URL>/invite?code=<inviteCode>
5. Invited user clicks link → frontend reads ?code= from URL
6. Frontend calls  →  POST /api/auth/invite/redeem  { code: "<inviteCode>" }
7. Server validates code via invite collection → fetches virtual UserAuth → starts session
8. User is logged in as virtual user; frontend prompts them to set a password
9. User calls  →  POST /api/auth/create  { username, password }
10. Server finds existing virtual UserAuth, converts it to real user (virtual flag removed)
11. Invite record remains in DB for audit; magic link no longer works (UserAuth not virtual)
```

---

## Verification

- `POST /auth/invite` without auth → session middleware blocks it
- `POST /auth/invite` with auth, new email → `{ success: true }`, virtual doc in `agent_auth`, invite doc in `invite`
- `POST /auth/invite` with auth, same email again → re-sends with fresh code, existing invite doc updated, same UserAuth oid preserved
- `POST /auth/invite` with auth, email of existing real user → `{ success: false, msg: 'user already exists' }`
- `POST /auth` (login) with virtual user's credentials → `{ success: false, msg: 'username or password incorrect' }`
- `POST /auth/invite/redeem` with valid code → `{ success: true, data: UserAuth }` + JWT in response headers
- `POST /auth/invite/redeem` with expired code → `{ success: false, msg: 'invite code has expired' }`
- `POST /auth/invite/redeem` with invalid code → `{ success: false, msg: 'invalid invite code' }`
- `POST /auth/invite/redeem` after user has registered → `{ success: false, msg: 'invalid invite code' }` (UserAuth no longer virtual)
- `POST /auth/create` with virtual user's username + valid password → virtual flag removed, real user created
- `POST /auth/create` with virtual user's username + weak password → `{ success: false, msg: <password requirements> }`
