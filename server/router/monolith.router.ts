import { Router } from './router';;

import { BaseRouter, RouteInfo } from './base.router';

export class MonolithRouter extends BaseRouter {
    init() {
        let routes: RouteInfo[] = [];
        routes = routes.concat(
            (new Router()).init(),
        );

        return routes;
    }
}