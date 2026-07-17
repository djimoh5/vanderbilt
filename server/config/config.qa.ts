import { BaseConfig } from './config.base';

export class Config extends BaseConfig {
    static ENVIRONMENT = 'qa';
    static REMOTE_SERVER_PORT = 5000;
}