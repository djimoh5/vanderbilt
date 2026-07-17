import { ModelSchema } from '../../model/schema.model';
import { ApiResponse } from '../../model/shared.model';

export type ApiMethod = 'get'|'post'|'delete';

export type ApiMethodLookup = { path: string, method: ApiMethod };

export interface AuthorizationEndpoint {
    privilege: string;
    resourceIdPath: string;
    methodName: string;
    path: string;
    method: ApiMethod;
    optional: boolean;
}

export interface ApiEndpoint { 
    method: ApiMethod;
    path: string;
    methodName: string;
    body?: ModelSchema;
    query?: ModelSchema;
    params?: ModelSchema;
    clientFacing?: boolean;
    description?: string;
    name?: string;
}

export class ApiFactory {
    lastApi: ApiMethodLookup; //path of the last Get/Post/Delete
    routes: ApiEndpoint[] = [];
    publicApiEndpoints: ApiMethodLookup[] = [];
    authorizedApiEndpoints: AuthorizationEndpoint[] = [];

    addRoute(method: ApiMethod, path: string, methodName: string, includeApiDocs: boolean) {
        this.routes.push({ path, method, methodName, clientFacing: includeApiDocs });
        this.lastApi = { path, method };
    }

    setSchema(method: ApiMethod, path: string, schema: ModelSchema) {
        if (schema.body) {
            this.setBody(method, path, schema.body);
        }
        if (schema.query) {
            this.setQuery(method, path, schema.query);
        }
        if (schema.params) {
            const keys = Object.keys(schema.params);
            const invalidKeys = keys.filter(k => k !== k.toLowerCase());
            if (invalidKeys.length > 0) {
                throw new Error(`${method}: ${path} - has invalid param keys (${invalidKeys.join(', ')})`);
            }
            this.setParams(method, path, schema.params);
        }
        if (schema.responses) {
            this.setRouteProperty('responses', method, path, schema.responses);
        }
        if (schema.description) {
            this.setRouteProperty('description', method, path, schema.description);
        }
        if (schema.name) {
            this.setRouteProperty('name', method, path, schema.name);
        }
        if (schema.request) {
            this.setBody(method, path, schema.request);
        }
    }

    setBody(method: ApiMethod, path: string, schema: ModelSchema) {
        this.setRouteProperty('body', method, path, schema);
    }

    setParams(method: ApiMethod, path: string, schema: ModelSchema) {
        this.setRouteProperty('params', method, path, schema);
    }

    setQuery(method: ApiMethod, path: string, schema: ModelSchema) {
        this.setRouteProperty('query', method, path, schema);
    }

    private setRouteProperty<T extends ModelSchema | ApiResponse<any>[] | string>(routeKey: 'body' | 'params' | 'query' | 'responses' | 'description' | 'name', method: ApiMethod, path: string, body: T) {
        const routes = this.routes.filter(route => route.path === path && route.method === method);

        for (let index = 0; index < routes.length; index++) {
            const route = routes[index];
            route[routeKey] = body as any;
        }
    }

    addAuthorizedRoute(optional: boolean, privilege: string, methodName: string, resourceIdPath?: string) {
        this.authorizedApiEndpoints.push({ privilege, methodName, resourceIdPath, path: this.lastApi.path, method: this.lastApi.method, optional: optional });
    }

    addPublicRoute() {
        this.publicApiEndpoints.push(this.lastApi);
    }

    isPublicRoute(path: string, method: ApiMethod) {
        return this.publicApiEndpoints.filter(a => a.path === path && a.method === method).length > 0;
    }

    isAuthorizedRoute(path: string, method: ApiMethod) {
        return this.authorizedApiEndpoints.filter(a => a.path === path && a.method === method).length > 0;
    }

    getMissingAuthorizationChecks(controllerName: string, controllerPath: string): string[] {
        const validate = (path: string, methodName: string, method: ApiMethod) => {
            const authorizedIndex = this.authorizedApiEndpoints.findIndex(a => a.path == path && a.method == method);

            const publicIndex = this.publicApiEndpoints.findIndex(endpoint => endpoint.path === path && endpoint.method === method);

            if (authorizedIndex === -1 && publicIndex === -1){
                // console.log("Unauthorized endpoint:", controllerName, method.toUpperCase(), `${methodName}('${path}')`);
                return `${controllerName}, ${controllerPath}/${path}, ${method.toUpperCase()}, ${methodName}\r\n`;
            }

            return '';
        };

        return this.routes.map(route => {
            return validate(route.path, route.methodName, route.method);
        }).filter(r => !!r);
    } 

    getAuthorizationChecks(controllerName: string, controllerPath: string): string[] {
        const logAuthorization = (auth: AuthorizationEndpoint) => {
            if (!auth){
                return '';
            }
            let resourceAccess = auth.privilege.replace(', ', ' | ');

            return `${resourceAccess}${auth.resourceIdPath? ' | path: ' + auth.resourceIdPath : ''}`;
        };

        const log = (path: string, methodName: string, method: ApiMethod) => {
            const authorizedEndpoints: AuthorizationEndpoint[] = this.authorizedApiEndpoints.filter(a => a.path == path && a.method == method);

            const publicEndpoint = this.publicApiEndpoints.find(endpoint => endpoint.path === path && endpoint.method === method);

            if (authorizedEndpoints.length > 0 || !!publicEndpoint){
                
                const optional = authorizedEndpoints.filter(auth => auth.optional).map(authorizedEndpoint => logAuthorization(authorizedEndpoint)).join(' or ');
                const required = authorizedEndpoints.filter(auth => !auth.optional).map(authorizedEndpoint => logAuthorization(authorizedEndpoint)).join(' and ');
                const authorizations = optional.length > 0 && required.length > 0? `${required} and (${optional})` : optional.length > 0? optional : required;

                return `${controllerName}, ${controllerPath}/${path}, ${method.toUpperCase()}, ${methodName}, ${!!publicEndpoint? 'PUBLIC' : authorizations}\r\n`;
            }

            return '';
        };

        return this.routes.map(route => {
            return log(route.path, route.methodName, route.method);
        }).filter(r => !!r);
    }

    getRoutes(): ApiEndpoint[] {
        return this.routes;
    }
}