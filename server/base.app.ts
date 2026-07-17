require('./lib/globals.js');

import { ErrorService } from './service/error.service';
import { ErrorType } from '../model/error.model';

import { BaseRouter } from './router/base.router';
import { Server } from './server';

export class App {
    server: Server;

    constructor(router: BaseRouter, hasStaticContent: boolean = true) {
        this.server = new Server(router, hasStaticContent);
    }

    getServer() {
        return this.server;
    }
}

process.on('uncaughtException', (err: any) => {
    ErrorService.log(err, ErrorType.UncaughtException);
});

process.on('unhandledRejection', (err: any, _promise: Promise<any>) => {
    ErrorService.log(err, ErrorType.UnhandledRejection);
});
