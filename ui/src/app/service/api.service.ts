import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

import { Cache } from '../utility/cache';
import { Common } from '../utility/common';

//import { AnalyticsService } from './analytics.service';
//import { AnalyticsEventCategory, AnalyticsTiming } from '../../../model/analytics.model';
import { UserHeaderKey } from '../../../../model/user.model';

import { Config } from '../config/config';
import { GenericMap } from '../../../../model/shared.model';

declare var window: any;

@Injectable()
export class ApiService {
    private SOURCE_CACHE_KEY: string = 'API_SOURCE';

    CacheExpiration: 300;
    cacheVersion: string;

    protected _baseUrl: string;
    get baseUrl(): string { return this._baseUrl; }
    get AuthorizationHeader(): { [key: string]: string } { return this.getAuthorizationHeader(); }
    get ApiCacheCategory(): string { return `api`; }

    private _apiUserId: string;
    get apiUserId(): string { return this._apiUserId; }

    constructor(private http: HttpClient, private tokenService: ApiTokenService) {
        this._baseUrl = `${Config.ApiUrl}`;
    }

    initCache() {
        if (!this.cacheVersion) {
            let cacheVersionKey = 'CACHE_API_VERSION';
            let cacheExpirationThreshold: number;
            this.cacheVersion = Cache.get(cacheVersionKey, this.ApiCacheCategory);

            if (this.cacheVersion !== Config.CacheVersion) {
                Cache.set(cacheVersionKey, this.ApiCacheCategory, Config.CacheVersion, 0);
                this.cacheVersion = Config.CacheVersion;
                cacheExpirationThreshold = null;
            }
            else {
                cacheExpirationThreshold = Config.CacheExpiration;
            }

            Cache.flush(this.ApiCacheCategory, cacheExpirationThreshold);
        }
    }

    clearApiCacheVersion() {
        Config.CacheVersion = null;
        Cache.remove('CACHE_API_VERSION');
    }

    setToken(token: string, userId: string, disableRefresh?: boolean) {
        this._apiUserId = userId;
        this.tokenService.setToken(token, this.ApiCacheCategory, disableRefresh);
    }

    refreshToken(token: string) {
        this.tokenService.refreshToken(token, this.ApiCacheCategory);
    }

    setSource(source: string) {
        if (source) {
            Cache.set(this.SOURCE_CACHE_KEY, this.ApiCacheCategory, source, 0);
        }
    }

    getSource() {
        return Cache.get(this.SOURCE_CACHE_KEY, this.ApiCacheCategory);
    }

    removeSource() {
        Cache.remove(this.SOURCE_CACHE_KEY, this.ApiCacheCategory);
    }

    get(endpoint: string, data: any = null): Observable<Response> {
        return this.execute(this.getRequest(endpoint, data));
    }

    getRequest(endpoint: string, data: any = null, _execute: boolean = true): ApiRequest {
        endpoint = this.buildQueryString(endpoint, data);

        return new ApiRequest(RequestMethod.Get, this.http, this.baseUrl + endpoint,
            {
                headers: this.getHeaders(),
                responseType: 'json'
            });
    }

    executeRequest(request: ApiRequest) {
        return this.execute(request);
    }

    post(endpoint: string, data: any): Observable<Response> {
        return this.execute(new ApiRequest(RequestMethod.Post, this.http, this.baseUrl + endpoint,
            {
                headers: this.getHeaders(),
                body: JSON.stringify(data),
                responseType: 'json'
            }));
    }

    put(endpoint: string, id: string, data: any): Observable<Response> {
        return this.execute(new ApiRequest(RequestMethod.Put, this.http, this.baseUrl + endpoint + '?id=' + id,
            {
                headers: this.getHeaders(),
                body: JSON.stringify(data),
                responseType: 'json'
            }));
    }

    delete(endpoint: string): Observable<Response> {
        return this.execute(new ApiRequest(RequestMethod.Delete, this.http, this.baseUrl + endpoint,
            {
                headers: this.getHeaders(),
                responseType: 'json'
            }));
    }

    download(endpoint: string, data: any = null) {
        endpoint = this.buildQueryString(endpoint, data);

        return this.execute(new ApiRequest(RequestMethod.Get, this.http, this.baseUrl + endpoint,
            {
                headers: this.getHeaders('application/octet-stream'),
                responseType: 'arraybuffer'
            }));
    }

    private buildQueryString(endpoint: string, data: any) {
        if (data != null) {
            var qs = "";
            for (var key in data) {
                qs += `&${key}=${encodeURIComponent(data[key])}`;
            }

            endpoint += '?' + qs.substring(1);
        }

        return endpoint;
    }

    private getHeaders(contentType: string = 'application/json') {
        var headers = this.getAuthorizationHeader();

        if (contentType) {
            headers['Accept'] = contentType;
            headers['Content-Type'] = contentType;
        }

        return headers;
    }

    private getAuthorizationHeader(): { [key: string]: string } {
        let headers: GenericMap<string> = {};

        let token = this.tokenService.getToken(this.ApiCacheCategory);
        if (token) {
            headers[UserHeaderKey.Authorization] = `Bearer ${token}`;
        }

        return headers;
    }

    private execute(request: ApiRequest): Observable<Response> {
        if (!request.options.body && request.method !== RequestMethod.Get) {
            request.options.body = '';
        }
        var observable: Observable<Response> = request.execute().pipe(share());
        (<any>observable)['request'] = request;

        var subscription = observable.subscribe(res => {
            const token = res.headers.get(UserHeaderKey.Authorization) || res.headers.get(UserHeaderKey.AppAuthorization);
            if (token) {
                this.tokenService.refreshToken(token.replace(/Bearer /i, ''), this.ApiCacheCategory);
            }

            subscription.unsubscribe();
        }, () => { });

        return observable;
    }
}

export class ApiRequest {
    id: string;
    startTime: number;
    attempts: number;
    maxAttempts: number;

    constructor(public method: RequestMethod, private service: HttpClient, private url: string, public options: ApiRequestOptions) {
        this.id = Common.uniqueMd5(url + JSON.stringify(options));
    }

    execute(): Observable<Response> {
        this.startTime = Date.now();
        this.options.observe = 'response';
        return this.service.request(this.method, this.url, this.options);
    }

    complete() {
        var duration = Date.now() - this.startTime;
        if(!Config.SuppressAPILogging) {
            console.log('API ' + this.method, this.url, this.options.body ? this.options.body : '', '- duration', duration, 'ms');
        }
        
        /*var timing: AnalyticsTiming = { category: AnalyticsEventCategory.api, variable: this.url, value: duration };

        if (this.options.body) {
            timing.label = this.options.body;
        }

        AnalyticsService.trackTiming(timing);*/
    }
}

export class ApiRequestOptions {
    body?: any;
    headers?: HttpHeaders | {
        [header: string]: string | string[];
    };
    params?: HttpParams | {
        [param: string]: string | string[];
    };
    observe?: 'body' | 'events' | 'response';
    reportProgress?: boolean;
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
    withCredentials?: boolean;
}

@Injectable()
export class ApiTokenService {
    private TOKEN_CACHE_KEY: string = 'API_TOKEN';

    private token: string;
    private disableTokenRefresh: boolean;

    constructor() {

    }

    setToken(token: string, apiCacheCategory: string, disableRefresh?: boolean) {
        if (!token) {
            Cache.remove(this.TOKEN_CACHE_KEY, apiCacheCategory);
            this.token = null;

            if (disableRefresh) {
                this.disableTokenRefresh = disableRefresh;
            }
        }
        else {
            this.refreshToken(token, apiCacheCategory);
        }
    }

    getToken(apiCacheCategory: string) {
        if (!this.token) {
            this.token = Cache.get(this.TOKEN_CACHE_KEY, apiCacheCategory);
        }

        return this.token;
    }

    refreshToken(token: string, apiCacheCategory: string) {
        if (!this.disableTokenRefresh) {
            this.token = token;
            Cache.set(this.TOKEN_CACHE_KEY, apiCacheCategory, this.token, 86400 * 30);
        }
    }
}

export enum RequestMethod {
    Get = "GET",
    Post = "POST",
    Put = "PUT",
    Delete = "DELETE"
}