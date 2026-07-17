# Plan: Login With Code (Speakeasy OTP)

## Context
Add a passwordless "login with code" flow. The user provides their email, receives a one-time 6-digit code, then submits that code to get a session token. Speakeasy (`^2.0.0`) is already installed but unused.

---

## Files to Create

### 1. `model/login-code.model.ts`
New model to store the temporary OTP state per user.

```typescript
import { Common } from "../utility/common";
import { uniqueid, UniqueId } from "./id.model";

export class LoginCode {
    oid: uniqueid;
    username: string;
    secret: string;    // base32 TOTP secret from speakeasy
    createdAt: number; // ms timestamp for 15-min expiry check
    used: boolean;

    constructor(username: string, secret: string) {
        this.oid = UniqueId(Common.uniqueId());
        this.username = username;
        this.secret = secret;
        this.createdAt = Date.now();
        this.used = false;
    }
}
```

### 2. `server/repository/login-code.repository.ts`
New repository for the `login_code` MongoDB collection.

```typescript
import { Bootstrap, Injectable } from "../config/bootstrap";
import { BaseRepository } from "./base.repository";
import { LoginCode } from "../../model/login-code.model";

@Injectable()
@Bootstrap()
export class LoginCodeRepository extends BaseRepository {
    constructor() {
        super('login_code');
    }

    getByUsername(username: string): Promise<LoginCode> {
        return this.context.findOne({ username: username, used: false });
    }

    save(loginCode: LoginCode): Promise<LoginCode> {
        return super.updateObject(loginCode);
    }
}
```

`updateObject` upserts by `oid`, so a new `LoginCode` instance always inserts. Multiple unused records per user are tolerable — TOTP produces the same code at the same time-step, and the 15-min expiry cleans up stale ones.

---

## Files to Modify

### 3. `server/service/auth.service.ts`

**New imports** (add after existing imports):
```typescript
import { LoginCodeRepository } from '../repository/login-code.repository';
import { LoginCode } from '../../model/login-code.model';
import { EmailService } from './email.service';
import { Email } from '../../model/email.model';

const speakeasy = require('speakeasy');
```

**Updated constructor** (add two new injected params):
```typescript
constructor(
    protected appService: AppService,
    protected authRepository: AuthRepository,
    protected loginCodeRepository: LoginCodeRepository,
    protected emailService: EmailService
) {
    super(appService);
    this.saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
}
```

**New method: `requestLoginCode`**
```typescript
async requestLoginCode(username: string): Promise<ApiResponse<null>> {
    const auth = await this.authRepository.getByUsername(username);

    // Always return success to prevent user enumeration
    if (!auth) {
        return new ApiResponse(true, null, 'If an account exists, a code has been sent.');
    }

    const secret = speakeasy.generateSecret();
    const code: string = speakeasy.totp.generate({ secret: secret.base32, encoding: 'base32' });

    await this.loginCodeRepository.save(new LoginCode(username, secret.base32));

    const email: Email = {
        to: [username],
        subject: 'Your login code',
        html: `<p>Your one-time login code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
    };
    this.emailService.sendEmail(email, auth.oid as string);

    return new ApiResponse(true, null, 'If an account exists, a code has been sent.');
}
```

**New method: `verifyLoginCode`**
```typescript
async verifyLoginCode(username: string, code: string): Promise<ApiResponse<UserAuth>> {
    const EXPIRY_MS = 15 * 60 * 1000;
    const loginCode = await this.loginCodeRepository.getByUsername(username);

    if (!loginCode || (Date.now() - loginCode.createdAt) > EXPIRY_MS) {
        return new ApiResponse(false, null, 'Invalid or expired code.');
    }

    const isValid: boolean = speakeasy.totp.verify({
        secret: loginCode.secret,
        encoding: 'base32',
        token: code,
        window: 1  // ±30s clock drift; 15-min expiry enforced manually above
    });

    if (!isValid) {
        return new ApiResponse(false, null, 'Invalid or expired code.');
    }

    loginCode.used = true;
    await this.loginCodeRepository.save(loginCode);

    const auth = await this.authRepository.getByUsername(username);
    if (!auth) {
        return new ApiResponse(false, null, 'Invalid or expired code.');
    }

    return new ApiResponse(true, auth);
}
```

### 4. `server/controller/api.controller.ts`

No new imports needed (AuthService already injected; `sendError` inherited from BaseController).

**Two new endpoint methods** (add after the existing `authenticate` method):
```typescript
@NoAuth()
@Post('auth/code/request')
async requestLoginCode(req: Request, res: Response) {
    const { username } = req.body;
    if (!username) {
        return this.sendError(res, 'username is required');
    }
    const data = await this.authService.requestLoginCode(username);
    res.send(data);
}

@NoAuth()
@Post('auth/code/verify')
async verifyLoginCode(req: Request, res: Response) {
    const { username, code } = req.body;
    if (!username || !code) {
        return this.sendError(res, 'username and code are required');
    }
    const data = await this.authService.verifyLoginCode(username, code);
    if (data.success) {
        req.session.start(data.data);
    }
    res.send(data);
}
```

`req.session.start()` sets the `Authorization: Bearer <token>` response header and populates `data.data.token` — exactly matching the existing `authenticate` endpoint pattern.

---

## Security Notes
- User enumeration: both paths of `requestLoginCode` return `{ success: true }` with the same message.
- Replay prevention: `used: true` is saved before the session is started.
- Expiry: enforced manually with `createdAt` — independent of speakeasy's time-window math.
- All failure branches in `verifyLoginCode` return the same error message.

---

## Verification

1. **Request code (user exists):** `POST /api/auth/code/request { username: "user@example.com" }` → `{ success: true, msg: "If an account exists..." }` + email arrives + `login_code` doc with `used: false` in DB.
2. **Request code (unknown user):** Same response shape, no email, no DB record.
3. **Verify — happy path:** `POST /api/auth/code/verify { username, code }` → `{ success: true, data: { oid, username, token } }` + `Authorization` header in response + `login_code.used = true`.
4. **Verify — replay:** Same request again → `{ success: false, msg: "Invalid or expired code." }`.
5. **Verify — wrong code:** Any incorrect token → same failure response.
6. **Verify — expired:** Manually set `createdAt` to 16 minutes ago in DB → failure response.
7. **TypeScript compile:** `cd server && npx tsc -p tsconfig.json --noEmit` — no new errors (speakeasy has no types; `require()` pattern already used for bcrypt).
