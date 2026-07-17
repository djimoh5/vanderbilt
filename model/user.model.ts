import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export interface User {
    oid: string;
    token?: string;
    username?: string;
    _ts?: number;
}

export class UserProfile implements BaseModel {
    oid?: uniqueid;
    authOid: authid;
    firstName: string;
    lastName: string;
}

export interface UserSummary {
    oid: authid;
    username: string;
    firstName?: string;
    lastName?: string;
    virtual?: boolean;
}

export class UserHeaderKey {
    static Authorization: string = 'Authorization';
    static AppAuthorization: string = 'App-Authorization';
    static EncryptionSecret = 'o9dJ!he#$43r34lwe';
    static UserAgent = 'user-agent';
    static CacheVersionId = 'cache-version';
    static RateLimiter = 'rate-limit';
}

export var UICacheKey = 'UI-Cache-Key';