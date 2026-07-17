import { Observable, Subscription } from 'rxjs';

import { ApiService, ApiRequest } from './api.service';
import { AppService } from './app.service';
import { Config } from '../config/config';
import { Cache } from '../utility/cache';

//import { QueueOperators } from '../../../../event/event-queue';
//import { BaseEvent, TypeOfBaseEvent, BaseEventCallback } from '../';

//import { PageLoadingEvent, SessionExpiredEvent, AlertEvent, AlertMessage } from '../event/app.event';

import { ApiResponse, GenericMap } from '../../../../model/shared.model';
import { AlertEvent } from 'bundle/event';
export { ApiResponse, ApiErrorResponse } from '../../../../model/shared.model';

export class BaseService {
    protected apiService: ApiService;
    protected appService: AppService;
    protected baseUrl: string;

    protected lastPromise: Promise<any>;
    private dupRequestThreshold: number = 500; // in ms

    private _serviceId: string;
    get serviceId(): string { return this._serviceId; }
    static nextServiceId: number = 0;

    static sessionExpired: boolean;

    constructor(apiService: ApiService, appService: AppService, baseUrl: string) {
        this.apiService = apiService;
        this.appService = appService;
        this.baseUrl = baseUrl;

        this._serviceId = `s${++BaseService.nextServiceId}`;
    }

    get(endpoint: string, query: {} = null, useCache: boolean = false, cacheOptions: CacheOptions = {}, canRetry: boolean = true): Promise<any> {
        let cacheKey: string, dataCacheKey: string;

        cacheOptions.query = cacheOptions.query ? cacheOptions.query : query;
        cacheOptions.expiration = cacheOptions.expiration ? cacheOptions.expiration : Config.CacheExpiration;

        if (useCache) {
            cacheKey = this.getCacheKey(endpoint, cacheOptions);

            if (query != null) {
                dataCacheKey = JSON.stringify(query);
            }

            let cacheData = Cache.get(cacheKey, this.apiService.ApiCacheCategory, dataCacheKey, cacheOptions.inMemory);

            if (typeof cacheData !== 'undefined') {
                return new Promise(resolve => {
                    resolve(cacheData);
                });
            }
        }

        let apiRequest = this.apiService.getRequest(this.endpoint(endpoint), query);

        if (canRetry) {
            apiRequest.maxAttempts = 2;
        }

        if (!this.isPromiseExpired(this.lastPromise) && (<any>this.lastPromise)['request'].id === apiRequest.id) {
            //exact same request in specified threshold, so return last promise
            var lastRequest = (<any>this.lastPromise)['request'];
            console.log(`DUPLICATE: ${lastRequest.id} API ${lastRequest.method} ${lastRequest.url}`);
            return this.lastPromise;
        }

        let promise = this.createPromise(this.apiService.executeRequest(apiRequest), false, apiRequest);

        if (useCache) {
            promise.then((result: any) => this.cacheResults(cacheKey, result, cacheOptions.expiration, dataCacheKey, cacheOptions.inMemory));
        }

        //if gateway failure, retry one time
        return promise.then((result: any) => {
            if (canRetry && result && !result.success && result.data && (result.data.status === 502 || result.data.status === 520) && apiRequest.attempts < apiRequest.maxAttempts) {
                if (window['fconsole']) {
                    window['fconsole'].log('GATEWAY FAILURE, RETRYING');
                }

                apiRequest.attempts++;
                return this.createPromise(this.apiService.executeRequest(apiRequest), false, apiRequest);
            }

            return promise;
        });

        return promise;
    }

    protected post(endpoint: string, data: GenericMap<any> = {}, suppressPageLoadingEvent: boolean = false) {
        if (!suppressPageLoadingEvent) {
            //this.appService.notify(new PageLoadingEvent(true));
        }
        if (data['_']) {
            delete data['_'];
        }

        return this.createPromise(this.apiService.post(this.endpoint(endpoint), data), !suppressPageLoadingEvent);
    }

    protected put(endpoint: string, id: string, data: Object, suppressPageLoadingEvent: boolean = false) {
        if (!suppressPageLoadingEvent) {
            //this.appService.notify(new PageLoadingEvent(true));
        }

        return this.createPromise(this.apiService.put(this.endpoint(endpoint), id, data), !suppressPageLoadingEvent);
    }

    protected delete(endpoint: string) {
        //this.appService.notify(new PageLoadingEvent(true));
        return this.createPromise(this.apiService.delete(this.endpoint(endpoint)), true);
    }

    protected download(endpoint: string, query: {} = null) {
        return this.createPromise(this.apiService.download(this.endpoint(endpoint), query), true);
    }

    protected isPromiseExpired(promise: Promise<any>): boolean {
        return !promise || !(<any>promise)['request'] || (Date.now() - (<any>promise)['request'].startTime > this.dupRequestThreshold);
    }

    private createPromise(observable: Observable<Response>, loadingShown: boolean = false, currentRequest?: ApiRequest): Promise<any> {
        let promise = new Promise(resolve => this.processResults(resolve, observable, loadingShown, currentRequest));

        if (currentRequest && Config.ShowErrors && this.lastPromise) {
            var lastRequest: ApiRequest = (<any>this.lastPromise)['request'];

            if (lastRequest && lastRequest.id === currentRequest.id && (currentRequest.startTime - lastRequest.startTime < this.dupRequestThreshold)) {
                console.log(`WARNING: duplicate api calls detected in last ${currentRequest.startTime - lastRequest.startTime} milliseconds: ${lastRequest.id}`);
                //this.appService.notify(new AlertEvent(AlertMessage.Error('warning: duplicate api calls detected')));
            }
        }

        (<any>promise)['request'] = currentRequest;
        this.lastPromise = promise;
        return promise;
    }

    private processResults(resolve: Function, observable: Observable<Response>, loadingShown: boolean = false, currentRequest?: ApiRequest) {
        var subscription: Subscription = observable.subscribe(
            (results: Response) => this.completeRequest(observable, () => {
                subscription.unsubscribe();
                resolve(results.body);
            }, loadingShown),
            (err: any) => this.completeRequest(observable, () => this.processError(err, resolve, currentRequest), loadingShown)
        );
    }

    private completeRequest(observable: Observable<Response>, requestOp: Function, loadingShown: boolean = false) {
        (<any>observable)['request'].complete();

        if (loadingShown) {
            //this.appService.notify(new PageLoadingEvent(false));
        }

        requestOp();
    }

    private processError(err: Response, resolve: Function, currentRequest?: ApiRequest) {
        console.log('api error', err);
        if (err) {
            if (err.status === 401) {
                if (!BaseService.sessionExpired) {
                    BaseService.sessionExpired = true;
                    this.apiService.setToken(null, null);
                    //this.appService.notify(new SessionExpiredEvent(null));
                    this.appService.notify(new AlertEvent({ message: 'Your session has expired, please login.' }));
                }
            }
            else {
                if (currentRequest && currentRequest.attempts < currentRequest.maxAttempts) {
                    resolve(new ApiResponse(false, { status: 520 }, 'Unknown Error'));
                }
                else {
                    if (Config.ShowErrors) {
                        console.log("error", err);
                        throw JSON.stringify(err)
                        //this.appService.notify(new AlertEvent(AlertMessage.Error(`API Request Error: ${err.statusText}`, null)));
                    }
                    else {
                        //this.appService.notify(new AlertEvent(AlertMessage.Error('an unexpected error occurred', 60000)));
                    }
                }
            }
        }
    }

    protected endpoint(path: string) {
        return path.length > 0 ? this.baseUrl + '/' + path : this.baseUrl;
    }

    protected cacheResults(cacheKey: string, result: any, cacheExpiration: number, subKey: string, inMemory: boolean) {
        Cache.set(cacheKey, this.apiService.ApiCacheCategory, result, cacheExpiration, subKey, inMemory);
    }

    protected removeCache(endpoint: string, options?: CacheOptions) {
        var cacheKey = this.getCacheKey(endpoint, options);
        Cache.remove(cacheKey, this.apiService.ApiCacheCategory);
    }

    private getCacheKey(endpoint: string, options: CacheOptions) {
        var cacheKey = this.endpoint(endpoint);

        if (this.apiService.apiUserId && (!options || !options.global)) {
            cacheKey += this.apiService.apiUserId;
        }

        return cacheKey + Config.CacheVersion;
    }

    /*subscribeEvent<T extends BaseEvent<any>>(eventType: TypeOfBaseEvent<T>, callback: BaseEventCallback<T>, operators?: QueueOperators<T>) {
        this.appService.subscribe(eventType, this.serviceId, callback, operators);
    }

    unsubscribeEvent(eventType?: typeof BaseEvent) {
        this.appService.unsubscribe(this.serviceId, eventType);
    }*/
}
export interface CacheOptions {
    expiration?: number;
    query?: {};
    global?: boolean;
    inMemory?: boolean;
}