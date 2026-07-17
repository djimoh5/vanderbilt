import express from 'express';
var cors = require('cors');
import { BaseRouter } from './router/base.router';
import { Config } from './config/config';

import { Injector } from './config/bootstrap';
import { BaseController } from './controller/base.controller';
import { AddressInfo } from 'net';
import { SecretManager } from './config/secret-manager';
import { UserHeaderKey } from '../model/user.model';
import { Database, DatabaseConnection } from './database/database';

export class Server {
    private app: express.Application;
    private server: any;
    routesInitialized: boolean;
    
    constructor(private router: BaseRouter, hasStaticContent: boolean = true) {
        this.app = express();

        if(hasStaticContent) {
            this.initStatic();
        }

        if(Config.SERVERLESS) {
            this.initRoutes();
        }
        else {
            SecretManager.init().then(()=> {
                this.initDB().then(() => {
                    this.initRoutes();
                });
            });

            const server = this.app.listen(Config.SERVER_PORT, () => {
                var host = (<AddressInfo>server.address()).address;
                var port = (<AddressInfo>server.address()).port;

                console.log('cortex server listening at http://%s:%s', host, port);
            });

            this.server = server;
        }
    }

    private async initDB() {
        await Database.openAll([DatabaseConnection.APP, DatabaseConnection.AUDIT, DatabaseConnection.LOG]);
    }

    private initRoutes() {
        if(!this.routesInitialized) {
            this.app.use(cors({ exposedHeaders: [UserHeaderKey.Authorization, UserHeaderKey.AppAuthorization, UserHeaderKey.CacheVersionId, UserHeaderKey.RateLimiter] }));

            this.router.init().forEach((route) => {
                this.app.use(route.path, (<BaseController>Injector.get(route.controller)).getRouter(route.path));
            });

            this.routesInitialized = true;
        }
    }

    private initStatic() {
        this.app.use('/', express.static('../ui/dist/ui/browser', { index: '_' }));
    }

    getServer() {
        return this.server;
    }

    getApp(): express.Application {
        return this.app;
    }
}