import { App } from './base.app';
import { Router } from './router/router';

const server = (new App(new Router()).getServer());
export const app = server.getApp();