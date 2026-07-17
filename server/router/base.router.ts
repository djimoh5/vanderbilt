import { BaseController } from '../controller/base.controller';

import { Config } from '../config/config';

export abstract class BaseRouter {
    protected getBaseUrl() {
        return Config.SERVERLESS ? '' : '/api';
    }

    abstract init(): RouteInfo[];
}

export interface RouteInfo {
    path: string;
    controller: { new(...services: any[]): BaseController; };
}