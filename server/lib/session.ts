import { User, UserHeaderKey } from '../../model/user.model';
import { UserAuth } from '../../model/auth.model';
//import { SessionLogRepository } from '../repository/session-log.repository';
import { ErrorService } from '../service/error.service';

import { Response, Request } from '../controller/base.controller';

import { Config } from '../config/config';
import { DeployConfig } from '../config/deploy.config';
import { Crypto, JwtToken } from './crypto';

import { Injector } from '../config/bootstrap';

import * as fs from 'fs';
import { Common } from '../../utility/common';
const API_SECRET_PRIVATE  = fs.readFileSync(__dirname + '/../config/app_secret_private.pem', 'utf8');
const API_SECRET_PUBLIC  = fs.readFileSync(__dirname + '/../config/app_secret_public.pem', 'utf8');

import { UAParser } from 'ua-parser-js';

export class Session implements ISession {
    sessionId: string;

    user: UserAuth;
    tenantId: string;
    log: SessionLog;

    private userAgent: UAParser.IResult;

    private tokenData: SessionTokenData;

    private referralSource: string;
    private tokenExpiration: number = 60 * 60 * 24 * 7; //60 min * 24 hours * 7 days = 1 week
    private tokenExpirationBuffer: number = this.tokenExpiration - (60 * 60 * 24); //1 day

    //private sessionLogRepository: SessionLogRepository;
    protected errorService: ErrorService;

    constructor(private request: Request, private response: Response) {
        this.sessionId = this.generateSessionId();

        const token = request.get(UserHeaderKey.Authorization);

        //this.sessionLogRepository = Injector.get(SessionLogRepository);
        this.errorService = Injector.get(ErrorService);

        const userAgent = request.get(UserHeaderKey.UserAgent);
        this.userAgent = UAParser(userAgent);

        this.resume(token);

        if(!this.user) {
            const error: any = { error: 'no session id' };
            this.user = error;
        }
    }

    private generateSessionId() {
        return Common.uniqueId();
    }

    start(user: UserAuth) {
        this.tenantId = user.tenantId;
        this.setTokenExpiration(user);

        //set new 90 min token with 5 min buffer so token isn't constantly refreshed
        const token = Session.setUserToken(user, user.tenantId, this.tokenExpiration + this.tokenExpirationBuffer, this.log);
        this.tokenData = token.data;
        
        this.response.setHeader(UserHeaderKey.Authorization, `Bearer ${user.token}`);
        this.response.setHeader(UserHeaderKey.AppAuthorization, `Bearer ${user.token}`); //AWS API Gateway is stripping authorization header for some reason


        this.setLogData();
    }

    removeTokenHeaders() {
        this.response.removeHeader(UserHeaderKey.Authorization);
        this.response.removeHeader(UserHeaderKey.AppAuthorization);
    }

    getTokenCreateDate() {
        return this.tokenData && this.tokenData.created;
    }

    static setUserToken(user: UserAuth, tenantId: string, expiration: number, _log?: SessionLog) {
        delete user.token;
        
        const token: SessionToken = { 
            data: {
                user: user,
                tenantId: tenantId,
                created: Date.now()
            }
        };
        //create new 90 min token with 5 min buffer so token isn't constantly refreshed
        user.token = Crypto.jwtToken(this.encryptSessionData(token), API_SECRET_PRIVATE, expiration, 'RS256');
        return token;
    }

    private resume(token: string) {
        if(token) {
            token = token.replace(/Bearer /i, '');
            const jwtToken: EncryptedSessionToken = Crypto.decryptJwtToken(token, API_SECRET_PUBLIC, 'RS256');
            const now = Math.floor(Date.now() / 1000);

            if(jwtToken && jwtToken.data) {
                let data = this.decryptSessionData(jwtToken);
                if (!data.user) {
                    return;
                }

                this.tokenData = data;
                this.tenantId = data.tenantId;
                this.setTokenExpiration(data.user);

                if(jwtToken.exp - now < this.tokenExpiration) {
                    this.start(data.user);
                    return;
                }
                else {
                    this.user = data.user;
                    this.user.token = token;
                }
            }
        }

        //set cache version for all requests
        this.response.setHeader(UserHeaderKey.CacheVersionId, this.getCacheVersion());

        //need to empty out or server sometimes returns an old cached auth (why?)
        this.response.setHeader(UserHeaderKey.Authorization, '');
        this.response.setHeader(UserHeaderKey.AppAuthorization, '');
        this.response.setHeader(UserHeaderKey.CacheVersionId, this.getCacheVersion());

        this.setLogData();
    }

    ssoAuth(token: string, secret: string): User {
        const jwtToken: EncryptedSessionToken = Crypto.decryptJwtToken(token, secret, 'HS256');

        if(jwtToken && jwtToken.data) {
            let data = this.decryptSessionData(jwtToken, secret);
            return data.user;
        }

        return null;
    }

    getCacheVersion(): string {
        return '1.0';//this.cacheService.get(UICacheKey, true) || '';
    }

    setTokenExpiration(_user: User) {
        //this method can be implemented to override default expiration for a platform.
        return;
    }

    getReferralCode() {
        return this.referralSource;
    }

    private setLogData() {
        const ip = this.getIpAddress();
        //const geo = geoip.lookup(ip); //'218.107.132.66' - CN, '58.64.128.0' - HK
        this.log = { sid: this.sessionId, uid: this.user && this.user.oid, tid: this.tenantId, path: this.request.originalUrl, ip: ip, server: DeployConfig.SERVER, geo: null, userAgent: this.getUserAgentString(), uri: `${this.request.controllerPath}${this.request.urlPath}`, method: this.request.method };//geo };
    }

    /*private logSession() {
        this.sessionLogRepository.log(this.log, AuditUser.getRequestUserOrApi({ ...this.request, session: this }));
	}

    private logEnded: boolean = false;
    logSessionEnd(error?: { code: number, [key: string]: string | number }) {
        if (this.logEnded) {
            return;
        }
        this.logEnded = true;
        this.sessionLogRepository.logEnd(this.sessionId, AuditUser.getRequestUserOrApi({ ...this.request, session: this }), error);
	}*/

    getUserAgentString() {
        return this.request.get(UserHeaderKey.UserAgent);
    }

    getUserAgent() {
        return this.userAgent;
    }

    getIpAddress() {
        return RequestUtility.getRequestIp(this.request);
    }

    getLogData() {
        return {
            ip: this.log.ip,
            forward: this.request.headers['x-forwarded-for'],
            uid: this.log.uid,
            url: this.log.path,
            server: this.log.server,
            userAgent: this.getUserAgent(),
            error: (<any>this.user).error,
            uiCacheId: this.getCacheVersion() || undefined,
            rateLimiterHeader: this.request.headers[UserHeaderKey.RateLimiter] || undefined,
        }
    }

    private static encryptSessionData(token: SessionToken): string {
        return Crypto.encrypt(JSON.stringify(token.data), Config.APP_API_SECRET);
    }

    private decryptSessionData(token: EncryptedSessionToken, secret?: string): SessionTokenData {
        return JSON.parse(Crypto.decrypt(token.data, secret || Config.APP_API_SECRET));
    }

    static mockSession(userId?: string) {
        return {
            user: { uid: userId},

            rateLimitValid: () => {
                return Promise.resolve(true);
            },
            
            getLogData: ()=> {
                return {};
            }
        };
    }
}

export interface SessionLog {
    sid: string; //our unique session ID
    uid: string;
    tid?: string;
    path: string;
    ip: string;
    server: string;
    geo: { country: string };
    method: string;
    uri: string;
    userAgent: string;
    error?: { code: number, [key: string]: string | number };
}

export interface SessionToken extends JwtToken {
    data: SessionTokenData;
}

export interface SessionTokenData { 
    user: UserAuth;
    tenantId: string;
    created: number;
}

export interface EncryptedSessionToken extends JwtToken {
    data: string;
}

export interface IUser {
    oid: string;
    error?: string;
}

export interface ISession {
    user: IUser;
}

export class RequestUtility {
    static getRequestIp(request: Request) {
        const forwardId = () => {
            let forwardIp: string = <string>request.headers['x-forwarded-for'];
            if (forwardIp) {
                const ips = forwardIp.split(',');
                forwardIp = (Config.LOAD_BALANCED_REQUEST && ips.length > 1 ? ips[ips.length - 2] : ips[ips.length - 1]).trim();
            }
    
            return forwardIp;
        };
    
        const ip = forwardId() || request.connection.remoteAddress; 
    
        if (ip && ip.substring(0, 7) == "::ffff:") {
            return ip.substring(7);
        }
    
        return ip;
    }
}