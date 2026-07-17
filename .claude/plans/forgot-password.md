# Plan: Forgot Password API Endpoint

## Context

Users who forget their password need a way to regain access without requiring an admin or knowing their current password. This feature adds a server-side forgot-password flow built on the existing one-time login code infrastructure (TOTP via `speakeasy`). The frontend is out of scope — this project only owns the API.

The existing login code flow (`POST /auth/code/request` → `POST /auth/code/verify`) already handles secure TOTP generation, email delivery, expiry, and single-use enforcement. Password reset reuses all of that, adding only purpose-scoping and a password-update step.

---

## Files Modified

| File | Change |
|------|--------|
| `model/login-code.model.ts` | Added `purpose: 'login' \| 'password_reset'` field |
| `server/repository/login-code.repository.ts` | `getByUsername` excludes reset codes; new `getByUsernameForReset` method |
| `server/service/auth.service.ts` | Added `requestPasswordReset` and `resetPassword` methods |
| `server/controller/api.controller.ts` | Added two new `@NoAuth @Post` endpoints |

---

## Implementation

### 1. `model/login-code.model.ts`
Add `purpose` field with a default of `'login'` so existing documents and call sites are backward-compatible.

```typescript
purpose: 'login' | 'password_reset';

constructor(username: string, secret: string, purpose: 'login' | 'password_reset' = 'login') {
    ...
    this.purpose = purpose;
}
```

### 2. `server/repository/login-code.repository.ts`
Scope existing query away from reset codes; add a dedicated reset query.

```typescript
getByUsername(username: string): Promise<LoginCode> {
    return this.context.findOne({ username, used: false, purpose: { $ne: 'password_reset' } });
}

getByUsernameForReset(username: string): Promise<LoginCode> {
    return this.context.findOne({ username, used: false, purpose: 'password_reset' });
}
```

> **Why scope the queries?** Without purpose isolation, a `findOne({ username, used: false })` could return a reset code when verifying a login code (or vice versa) if both are outstanding simultaneously.
>
> **Backward compat:** `$ne: 'password_reset'` matches documents that have no `purpose` field (pre-existing login codes), so old records continue to work.

### 3. `server/service/auth.service.ts`

**`requestPasswordReset(username)`**
- Reuses: `authRepository.getByUsername`, `loginCodeRepository.save`, `emailService.sendEmail`, `speakeasy`
- Blocks virtual (invite-pending) users — same guard as `login()`
- Saves `new LoginCode(username, secret.base32, 'password_reset')`
- Sends email with subject "Reset your password" and the 6-digit code
- Always returns the same vague success message (prevents account enumeration)

**`resetPassword(username, code, newPassword)`**
- Reuses: `loginCodeRepository.getByUsernameForReset`, `speakeasy.totp.verify`, `PasswordUtility.isPasswordSecure`, private `persistAuth`
- 15-minute expiry check (same as login code)
- Validates password strength via `PasswordUtility` before writing
- Marks code `used = true` **before** calling `persistAuth` — ensures the code is invalidated even if the password write fails mid-flight
- Returns `ApiResponse<null>` — no session is started; the user must log in separately with the new password

### 4. `server/controller/api.controller.ts`

```
POST /api/auth/password/reset/request   { username }                        → ApiResponse<null>
POST /api/auth/password/reset/confirm   { username, code, newPassword }      → ApiResponse<null>
```

Both decorated `@NoAuth()` (public, no session required).

---

## Reused Utilities

- `speakeasy.generateSecret()` / `speakeasy.totp.generate()` / `speakeasy.totp.verify()` — TOTP generation and verification
- `PasswordUtility.isPasswordSecure` / `insecurePasswordMessage` — `utility/password.utility.ts`
- `persistAuth(username, password)` — private method in `AuthService`, hashes and upserts the credential
- `LoginCode` model + `LoginCodeRepository.save` — unchanged save path
- `emailService.sendEmail(email, oid)` — Mandrill delivery

---

## Verification

### Manual end-to-end
```bash
# 1. Start the server
cd server && npx ts-node app.ts

# 2. Request a reset code (use a real seeded username/email)
curl -X POST http://localhost:8080/api/auth/password/reset/request \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com"}'
# Expect: { success: true, message: "If an account exists, a reset code has been sent." }

# 3. Check email for the 6-digit code, then confirm
curl -X POST http://localhost:8080/api/auth/password/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "code": "123456", "newPassword": "NewPass1!"}'
# Expect: { success: true, message: "Password has been reset successfully." }

# 4. Verify old password no longer works, new password does
curl -X POST http://localhost:8080/api/auth \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "NewPass1!"}'
# Expect: { success: true, data: { ... } }
```

### Edge cases to verify
- Non-existent username → always returns `success: true` (no enumeration)
- Virtual user → same vague success, no email
- Wrong/expired code → `{ success: false, message: "Invalid or expired code." }`
- Weak `newPassword` (e.g. `"abc"`) → `{ success: false, message: "password must be at least 8 chars long" }`
- Replaying the same code after success → `success: false` (code marked `used`)
- Requesting a login code while a reset code is outstanding (and vice versa) → each flow only sees its own code
