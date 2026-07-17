# Plan: User Profile API Endpoint

## Context

The application currently has auth (login/register/invite) but no user profile data. We need a `user_profile` MongoDB collection and a `POST /api/user/profile` endpoint so clients can store and update a user's first and last name. The profile is linked to the authenticated user via `authOid` (the `UserAuth.oid`). Access requires a valid JWT — no anonymous access.

---

## Files to Create

### 1. `model/user-profile.model.ts`
New model with `oid`, `authOid` (reference to `UserAuth`), `firstName`, `lastName`.

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export class UserProfile implements BaseModel {
    oid?: uniqueid;
    authOid: authid;
    firstName: string;
    lastName: string;
}
```

### 2. `server/repository/user-profile.repository.ts`
Extends `BaseRepository`, uses `user_profile` collection on the `APP` connection.

- `getByAuthOid(authOid)` — `context.findOne({ authOid })`
- `save(profile)` — `context.update({ authOid: profile.authOid }, profile, null, { upsert: true })`
  - Upserts by `authOid` (one profile per user), preserving the existing `oid` on updates and inserting with a generated `oid` on first save.

### 3. `server/service/user-profile.service.ts`
Extends `BaseService`, depends on `UserProfileService` and `UserProfileRepository`.

- `getProfile(authOid)` — fetches profile, returns `ApiResponse<UserProfile>`
- `updateProfile(authOid, firstName, lastName)` — loads existing or constructs new (generates `oid` with `UniqueId(Common.uniqueId())`), sets fields, saves, returns `ApiResponse<UserProfile>`

---

## Files to Modify

### 4. `server/controller/api.controller.ts`

Inject `UserProfileService` in the constructor alongside `AuthService`. Add two endpoints:

```typescript
@Get('user/profile')
async getProfile(req: Request, res: Response) {
    const data = await this.userProfileService.getProfile(req.session.user.oid);
    res.send(data);
}

@Post('user/profile')
async updateProfile(req: Request, res: Response) {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) {
        return this.sendError(res, 'firstName and lastName are required');
    }
    const data = await this.userProfileService.updateProfile(req.session.user.oid, firstName, lastName);
    res.send(data);
}
```

No `@NoAuth` — both endpoints require a valid JWT by default.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `@Injectable() @Bootstrap()` on repo/service | `server/repository/login-code.repository.ts` |
| `super.updateObject()` / `context.update(..., { upsert: true })` | `server/repository/base.repository.ts:69` |
| `BaseService` constructor with `AppService` | `server/service/auth.service.ts` |
| `UniqueId(Common.uniqueId())` for oid generation | `model/id.model.ts` + `model/auth.model.ts` pattern |
| `req.session.user.oid` to get current user | `server/controller/api.controller.ts:122` |
| `sendError` / `res.send(data)` response pattern | `server/controller/api.controller.ts` |

---

## Verification

1. Start the server: `cd server && npx ts-node app.ts`
2. Authenticate to get a token: `POST /api/auth` with `{ username, password }`
3. Update profile: `POST /api/user/profile` with header `Authorization: Bearer <token>` and body `{ "firstName": "Jane", "lastName": "Doe" }` — expect `{ success: true, data: { oid, authOid, firstName, lastName } }`
4. Get profile: `GET /api/user/profile` with same auth header — expect same shape
5. Call `POST /api/user/profile` again with different names — verify the same document is updated (no duplicates in `user_profile` collection)
6. Call without auth header — expect `401 Unauthorized`
