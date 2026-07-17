import { App } from './base.app';
import { MonolithRouter } from './router/monolith.router';
import { Config } from './config/config';

Config.SERVERLESS = true;

export var server = (new App(new MonolithRouter(), false)).getServer();