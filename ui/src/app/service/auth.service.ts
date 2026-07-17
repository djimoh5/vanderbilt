import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service'

import { UserAuth, UserHeaderKey } from 'bundle/model';

@Injectable()
export class AuthService extends BaseService {
    private _userAuth: UserAuth;

    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    get isAuthenticated(): boolean {
        return !!this._userAuth?.token || !!this.apiService.AuthorizationHeader[UserHeaderKey.Authorization];
    }

    get currentUsername(): string {
        return this._userAuth?.username;
    }

    get currentUserId(): string {
        return this._userAuth?.oid;
    }

    async resume(): Promise<boolean> {
        const res = await this.authenticate();
        return res.success;
    }

    async authenticate(userAuth?: UserAuth): Promise<ApiResponse<UserAuth>> {
        const res = await this.post(`auth`, userAuth);
        return this.processResponse(res);
    }

    async create(userAuth: UserAuth): Promise<ApiResponse<UserAuth>> {
        const res = await this.post(`auth/create`, userAuth);
        return this.processResponse(res);
    }

    async updateAuth(userAuth: UserAuth): Promise<ApiResponse<UserAuth>> {
        const res = await this.post(`auth/update`, userAuth);
        return this.processResponse(res);
    }

    async requestLoginCode(username: string): Promise<ApiResponse<null>> {
        return await this.post(`auth/code/request`, { username });
    }

    async verifyLoginCode(username: string, code: string): Promise<ApiResponse<UserAuth>> {
        const res = await this.post(`auth/code/verify`, { username, code });

        if(res.success) {
            return this.processResponse(res);
        }
        
        return res;
    }

    async requestPasswordReset(username: string): Promise<ApiResponse<null>> {
        return this.post('auth/password/reset', { username });
    }

    async confirmPasswordReset(username: string, code: string, newPassword: string): Promise<ApiResponse<null>> {
        return this.post('auth/password/reset/confirm', { username, code, newPassword });
    }

    async invite(username: string): Promise<ApiResponse<{ oid: string }>> {
        return this.post('auth/invite', { username });
    }

    disconnect() {
        this.processResponse({ success: true, data: null });
    }

    processResponse(res: ApiResponse<UserAuth>) {
        if (res.success) {
            this._userAuth = res.data;
            this.apiService.setToken(this._userAuth ? this._userAuth.token : null, this._userAuth ? this._userAuth.oid : null);
        }
        
        return res;
    }
}