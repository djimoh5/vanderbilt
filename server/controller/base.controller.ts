var url = require('url');

import * as express from 'express';
import { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import { Session } from '../lib/session';
import { Privilege } from '../../model/privilege.model';
//import { Injector } from '../config/bootstrap';
import { AuthorizationService } from '../service/authorization.service';

import { Common } from '../../utility/common';
import { ApiFactory, ApiMethod } from '../utility/api.factory';
import { ErrorService } from '../service/error.service';
import { ErrorType } from '../../model/error.model';
import { ApiResponse, ApiErrorResponse } from '../../model/shared.model';
import { Injector } from '../config/bootstrap';
import { Config } from '../config/config';

export function AllowAnonymous() {
    return (target) => {
        target.allowAnonymous = true;
    };
}

/**
* Makes sure to put on BOTTOM of the decorator stack
*/
export function Get(path: string, includeApiDocs?: boolean) {
    return apiEndpoint('get', path, includeApiDocs);
}

/**
* Makes sure to put on BOTTOM of the decorator stack
*/
export function Post(path: string, includeApiDocs?: boolean) {
    return apiEndpoint('post', path, includeApiDocs);
}

/**
* Makes sure to put on BOTTOM of the decorator stack
*/
export function Delete(path: string, includeApiDocs?: boolean) {
    return apiEndpoint('delete', path, includeApiDocs);
}

export function apiEndpoint(type: ApiMethod, path: string, includeApiDocs: boolean) {
    return (target: BaseController, methodName: string, descriptor: PropertyDescriptor) => {
        target.apiFactory.addRoute(type, path, methodName, includeApiDocs);
        
        if (descriptor.value.pathsApplied && descriptor.value.pathsApplied.indexOf(path) >= 0){
            throw new Error(`${target.constructor.name}: Duplicate of ${type.toUpperCase()} on ${methodName}('${path}')`);
        }

        if (!descriptor.value.pathsApplied) {
            descriptor.value.pathsApplied = [];
        }

        descriptor.value.pathsApplied.push(path);
        descriptor.value.method = type;
    };
}

/*export function Admin() {
    return Auth(new Privilege(PrivilegeResource.Admin, PrivilegeAccess.View));
}*/

/*
* Make sure to put this AFTER the method type (Get, Post, Put)
*/
export function Auth(priv: Privilege, resourceIdPath?: string) {
    return (target: BaseController, _propertyKey: string, descriptor: PropertyDescriptor) => {
        const lastDescriptor: Function = descriptor.value;
        descriptor.value = function () {
            const args = arguments;
            const req: Request = args[0];
            const res: Response = args[1];
            let resourceId: any = null;

            //Lookup by resourceId, otherwise no resourceId will be set
            //Use global privilege otherwise fail
            if(resourceIdPath) {
                resourceId = Common.valueFromJsonPath(req, resourceIdPath);
            }

            var auth = Injector.get(AuthorizationService) as AuthorizationService;

            var singleResourceId = resourceId && Common.isArray(resourceId) ? resourceId[0] : resourceId;

            //TODO: Check all accountIds
            auth.isAuthorized(req.session.user, priv, singleResourceId).then(isAuthorized => {
                if(isAuthorized) {
                    return lastDescriptor.apply(this, args);
                }
                else {
                    return target.forbiddenAccess(res);
                }
            });

            return null;
        };
    };
}

/*
* Make sure to put this AFTER the method type (Get, Post, Put)
*/
export function NoAuth() {
    return (target: BaseController, _propertyKey: string, descriptor: PropertyDescriptor) => {
        target.apiFactory.addPublicRoute();
        descriptor.value.decoratorApplied = true;
    };
}

export interface Request extends ExpressRequest {
    session: Session;
    agentId: number;
    controller: string;
    methodName: string;
    rawBody?: string;
    controllerPath: string;
    urlPath: string;
    //override
    query: { [key: string]: any };
}

export interface ModelRequest<T> extends Request {
    body: T;
}

export interface Response extends ExpressResponse {    
}

export abstract class BaseController {
    private router: express.Router = express.Router();
    private _apiFactory: ApiFactory;

    abstract init(req: Request);

    get apiFactory() {
        if (!this._apiFactory){
            this._apiFactory = new ApiFactory();
        }
        return this._apiFactory;
    }

    constructor() {
        this.router = express.Router();

        /*this.router.use((_req: Request, res: Response, next) => {
            res.set('Cross-Origin-Embedder-Policy', 'require-corp');
            res.set('Cross-Origin-Opener-Policy', 'same-origin');
            next();
        });*/

        this.router.use(bodyParser.json({ limit: '10mb' }));
        this.router.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
        this.router.use((req: Request, res: Response, next) => { this.queryParser(req, res, next); });
    }

    private queryParser(req: Request, _res: Response, next: NextFunction) {
        req.query = url.parse(req.url, true).query;
        next();
    }

    private initRequestSession(req: Request, res: Response, next: NextFunction, controllerPath?: string) {
        this.initSession(req, res, controllerPath);
        next();
    }

	private initSession(req: Request, res: Response, path?: string) {
        req.controller = this.constructor.name;
        req.controllerPath = path;
        req.urlPath = req.route && req.route.path;
        req.session = new Session(req, res);
    }
    
    /** DEBUG 
    private logRequest(req: Request) {
        if(req.originalUrl.indexOf('/api/') >= 0) {
            console.log(req.originalUrl);
            if(req.query) {
                console.log('Query', req.query);
            }
            if(req.body) {
                console.log('Body', req.body);
            }
            console.log('-------------------------------------');
        }
    }
    //**/

    getRouter(controllerPath: string) {
        this.apiFactory.getRoutes().forEach(route => {
            this.addToRouter(route.path, route.method, route.methodName, controllerPath);
        });

		return this.router;
    }

    protected sendSuccess(res: Response, data: any) {
        res.send(new ApiResponse(true, data));
    }

    protected sendError(res: Response, msg: string) {
        res.send(new ApiErrorResponse(msg));
    }

    unauthorizedAccess(res: Response) {
        res.status(401);
        res.send({ code: 401, message: 'Authentication required' });
    }

    forbiddenAccess(res: Response) {
        res.status(403);
        res.send({ code: 403, message: 'Forbidden access' });
    }
    
    private addToRouter(path: string, method: ApiMethod, methodName: string, controllerPath: string) {
        this.router[method](this.getRoutePath(path), (req: Request, res: Response, next) => this.initRequestSession(req, res, next, controllerPath), async (req: Request, res: Response) => {
            req.controller = this.constructor.name;
            req.methodName = methodName;

            //console.log('PATH:', path, 'AGENT:', req.session.user.username);
            const scopedController: BaseController = Injector.get(<any>this.constructor, req.session.tenantId);
            
            if(scopedController.isAuthenticated(req, res, path, method)) {
                try {
                    await scopedController.init(req);
                    await scopedController[methodName](req, res);
                }
                catch(err){
                    ErrorService.log(err, ErrorType.CaughtException);

                    if (!res.headersSent) {
                        res.status(500).send(new ApiErrorResponse('an unexpected error occurred'));
                    }
                }
            }
        });
    }

    private isAuthenticated(req: Request, res: Response, path: string, method: ApiMethod) {
        if((req.session.user && req.session.user.token) 
            || (Config.ENVIRONMENT === 'dev' && req.originalUrl.indexOf('/api/') < 0)
            || this.apiFactory.isPublicRoute(path, method)) {
            return true;
        }
        else {
            this.unauthorizedAccess(res);
            return false;
        }
    }
    
    private getRoutePath(key) {
        return '/' + (key == 'index' ? '' : key.toLowerCase());
    }
}