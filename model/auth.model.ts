import { Common } from "../utility/common";
import { authid, uniqueid, AuthId } from "./id.model";
import { BaseModel } from "./shared.model";
import { UserProfile } from "./user.model";

export class UserAuth implements BaseModel {
    oid: authid;
    token?: string;
    virtual?: boolean;
    profile?: UserProfile;

    constructor(public username: string, public password: string, public tenantId: uniqueid) {
        this.oid = AuthId(Common.uniqueId());
    }
}

export enum LoginCodePurpose {
    Login = 'login',
    PasswordReset = 'password_reset'
}

export class LoginCode {
    oid: uniqueid;
    username: string;
    secret: string;    // base32 TOTP secret from speakeasy
    createdAt: number; // ms timestamp for 15-min expiry check
    used: boolean;
    purpose: LoginCodePurpose;

    constructor(username: string, secret: string, purpose: LoginCodePurpose) {
        this.oid = Common.uniqueId();
        this.username = username;
        this.secret = secret;
        this.createdAt = Date.now();
        this.used = false;
        this.purpose = purpose;
    }
}
