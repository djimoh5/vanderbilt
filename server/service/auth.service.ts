
import { Bootstrap, Injectable } from '../config/bootstrap';
import { AuthRepository } from '../repository/auth.repository';
import { InviteRepository } from '../repository/invite.repository';
import { LoginCodeRepository } from '../repository/login-code.repository';
import { UserProfileRepository } from '../repository/user-profile.repository';

import { ApiResponse, BaseService } from './base.service';
import { AppService } from './app.service';
import { EmailService } from './email.service';
import { TenantService } from './tenant.service';

import { UserAuth } from '../../model/auth.model';
import { UniqueId } from '../../model/id.model';
import { UserSummary } from '../../model/user.model';
import { Invite } from '../../model/invite.model';
import { LoginCode, LoginCodePurpose } from '../../model/auth.model';
import { Email } from '../../model/email.model';
import { PasswordUtility } from '../../utility/password.utility';
import { Config } from '../config/config';
import { Common } from '../../utility/common';

const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

@Injectable()
@Bootstrap()
export class AuthService extends BaseService {
    private readonly saltRounds: number;

    constructor(
        protected appService: AppService,
        protected authRepository: AuthRepository,
        protected inviteRepository: InviteRepository,
        protected loginCodeRepository: LoginCodeRepository,
        protected emailService: EmailService,
        protected userProfileRepository: UserProfileRepository,
        protected tenantService: TenantService
    ) {
        super(appService);

        this.saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
    }

    private async attachProfile(auth: UserAuth): Promise<void> {
        const profile = await this.userProfileRepository.getByAuthOid(auth.oid);
        if (profile) {
            auth.profile = profile;
        }
    }

    async updateAuth(username: string, password: string, newPassword: string): Promise<ApiResponse<UserAuth>> {
        const existing = await this.authRepository.getByUsernameWithCredentials(username);
        if (existing) {
            if(!(await this.authenticate(username, password))) {
                return new ApiResponse(false, null, 'unauthorized access');
            }

            return this.persistAuth(username, newPassword);
        }

        return new ApiResponse(false, null, 'unauthorized access');
    }

    update(auth: UserAuth) {
        return this.authRepository.update(auth);
    }

    async authenticate(username: string, password: string, create?: boolean, bypassPassword?: boolean, tenantId?: string): Promise<ApiResponse<UserAuth>> {
        if (!username) {
            return new ApiResponse(false, null, 'username or password incorrect');
        }

        const auth = await this.authRepository.getByUsernameWithCredentials(username);

        if(create) {
            return this.register(auth, username, password, tenantId);
        }

        return this.login(auth, password, bypassPassword);
    }

    private register(auth: UserAuth, username: string, password: string, tenantId?: string) {
        if (!auth || auth.virtual) {
            if (PasswordUtility.isPasswordSecure(password)) {
                return this.persistAuth(username, password, tenantId);
            }
            return new ApiResponse(false, null, PasswordUtility.insecurePasswordMessage(password));
        }
        return new ApiResponse(false, null, 'the user already exists');
    }

    private async login(auth: UserAuth, password: string, bypassPassword?: boolean): Promise<ApiResponse<UserAuth>> {
        if (!auth || auth.virtual) {
            return new ApiResponse(false, null, 'username or password incorrect');
        }

        let valid: boolean;

        try {
            valid = bypassPassword || await bcrypt.compare(password, auth.password);
        } catch (_err) {}

        if (!valid) {
            return new ApiResponse(false, null, 'username or password incorrect');
        }
        delete auth.password;
        await this.attachProfile(auth);
        return new ApiResponse(true, auth);
    }

    async requestLoginCode(username: string): Promise<ApiResponse<null>> {
        const auth = await this.authRepository.getByUsername(username);

        if (!auth) {
            return new ApiResponse(true, null, 'If an account exists, a code has been sent.');
        }

        const secret = speakeasy.generateSecret();
        const code: string = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

        await this.loginCodeRepository.save(new LoginCode(username, secret.base32, LoginCodePurpose.Login));

        const email: Email = {
            to: [username],
            subject: `Your ${Config.APP_NAME} Login Code`,
            html: `<div style="font-size: 16px;">
                Your one-time login code is: <strong>${code}</strong><br><br>
                This code expires in 5 minutes.
            </div>`
        };

        await this.emailService.sendEmail(email, auth.oid as string);

        return new ApiResponse(true, null, 'If an account exists, a code has been sent.');
    }

    async verifyLoginCode(username: string, code: string): Promise<ApiResponse<UserAuth>> {
        const EXPIRY_MS = 5 * 60 * 1000;
        const loginCode = await this.loginCodeRepository.getByUsername(username);

        if (!loginCode || (Date.now() - loginCode.createdAt) > EXPIRY_MS) {
            return new ApiResponse(false, null, 'Invalid or expired code.');
        }

        const isValid: boolean = speakeasy.totp.verify({
            secret: loginCode.secret,
            encoding: 'base32',
            token: code,
            window: 10
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

        await this.attachProfile(auth);
        return new ApiResponse(true, auth);
    }

    async requestPasswordReset(username: string): Promise<ApiResponse<null>> {
        const auth = await this.authRepository.getByUsername(username);

        if (!auth || auth.virtual) {
            return new ApiResponse(true, null, 'If an account exists, a reset code has been sent.');
        }

        const secret = speakeasy.generateSecret();
        const code: string = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

        await this.loginCodeRepository.save(new LoginCode(username, secret.base32, LoginCodePurpose.PasswordReset));

        const email: Email = {
            to: [username],
            subject: `Reset your ${Config.APP_NAME} password`,
            html: `<div style="font-size: 16px;">
                Your password reset code is: <strong>${code}</strong><br><br>
                This code expires in 5 minutes. If you did not request a password reset, you can ignore this email.
            </div>`
        };

        await this.emailService.sendEmail(email, auth.oid as string);

        return new ApiResponse(true, null, 'If an account exists, a reset code has been sent.');
    }

    async resetPassword(username: string, code: string, newPassword: string): Promise<ApiResponse<null>> {
        const EXPIRY_MS = 5 * 60 * 1000;
        const loginCode = await this.loginCodeRepository.getByUsernameForReset(username);

        if (!loginCode || (Date.now() - loginCode.createdAt) > EXPIRY_MS) {
            return new ApiResponse(false, null, 'Invalid or expired code.');
        }

        const isValid: boolean = speakeasy.totp.verify({
            secret: loginCode.secret,
            encoding: 'base32',
            token: code,
            window: 10
        });

        if (!isValid) {
            return new ApiResponse(false, null, 'Invalid or expired code.');
        }

        if (!PasswordUtility.isPasswordSecure(newPassword)) {
            return new ApiResponse(false, null, PasswordUtility.insecurePasswordMessage(newPassword));
        }

        loginCode.used = true;
        await this.loginCodeRepository.save(loginCode);
        
        await this.persistAuth(username, newPassword);

        return new ApiResponse(true, null, 'Password has been reset successfully.');
    }

    async invite(username: string, invitedBy: string, tenantId: string): Promise<ApiResponse<{ oid: string }>> {
        const auth = await this.authRepository.getByUsername(username);
        if (auth && !auth.virtual) {
            return new ApiResponse(false, null, 'user already exists');
        }

        let userAuth: UserAuth;
        if (!auth) {
            userAuth = new UserAuth(username, '', UniqueId(tenantId)); // the inviter's own tenant, not a new one
            userAuth.virtual = true;
            await this.authRepository.update(userAuth);
        } else {
            userAuth = auth;
        }

        const inviteCode = Common.uniqueId();
        const inviteExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

        const existing = await this.inviteRepository.getByUsername(username);
        let invite: Invite;
        if (existing) {
            existing.inviteCode = inviteCode;
            existing.inviteExpiry = inviteExpiry;
            existing.invitedBy = invitedBy;
            invite = existing;
        } else {
            invite = new Invite(username, inviteCode, inviteExpiry, invitedBy);
        }
        await this.inviteRepository.save(invite);

        const email: Email = {
            to: [username],
            subject: `You've been invited to ${Config.APP_NAME}`,
            html: `<div style="text-align: center; font-size: 16px;">
                You've been invited to join ${Config.APP_NAME}!<br><br>
                Click the link below to get started.<br>
                <a href="${Config.APP_URL}/invite?code=${inviteCode}">Accept Invite</a>
            </div>`
        };
        
        await this.emailService.sendEmail(email, invitedBy);

        return new ApiResponse(true, { oid: userAuth.oid as string });
    }

    async getUserList(): Promise<ApiResponse<UserSummary[]>> {
        const users = await this.authRepository.getAll();
        const profile = await this.userProfileRepository.getByAuthOids(users.map(u => u.oid));
        const profileMap = Common.arrayToHashTable(profile, 'authOid');

        const summaries: UserSummary[] = users.map(u => ({
            oid: u.oid,
            username: u.username,
            firstName: profileMap[u.oid]?.firstName,
            lastName: profileMap[u.oid]?.lastName,
            virtual: u.virtual,
        }));
        return new ApiResponse(true, summaries);
    }

    async redeemInviteCode(code: string): Promise<ApiResponse<UserAuth>> {
        const invite = await this.inviteRepository.getByCode(code);
        if (!invite) {
            return new ApiResponse(false, null, 'invalid invite code');
        }
        if (Date.now() > invite.inviteExpiry) {
            return new ApiResponse(false, null, 'invite code has expired');
        }
        const auth = await this.authRepository.getByUsername(invite.username);
        if (!auth) {
            return new ApiResponse(false, null, 'invalid invite code');
        }
        delete auth.virtual;
        await this.authRepository.removeVirtualFlag(auth.oid as string);
        return new ApiResponse(true, auth);
    }

    private async persistAuth(username: string, password: string, tenantId?: string) {
        const hash = await bcrypt.hash(password, this.saltRounds);
        let auth: UserAuth;

        const existingAuth = await this.authRepository.getByUsernameWithCredentials(username);

        if (existingAuth) {
            existingAuth.password = hash;
            delete existingAuth.virtual;
            auth = await this.authRepository.update(existingAuth); // tenantId untouched — already set at invite time
        } else {
            const isNewTenant = !tenantId;
            const resolvedTenantId = UniqueId(tenantId || Common.uniqueId());

            const newAuth = new UserAuth(username, hash, resolvedTenantId);
            if (isNewTenant) {
                (newAuth as any)._tid = resolvedTenantId; // bypass the ambient '' scope's auto-stamp so this tenantId sticks
            }
            auth = await this.authRepository.update(newAuth);

            if (isNewTenant) {
                await this.tenantService.createForSignup(resolvedTenantId, username); // default tenant name; renamed later via TenantController
            }
        }
        delete auth.password;
        return new ApiResponse(true, auth);
    }
}