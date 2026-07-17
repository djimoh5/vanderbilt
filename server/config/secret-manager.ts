import { Config } from '../config/config';
import { DeployConfig } from './deploy.config';

const fs = require('fs');

export class SecretManager {
    private static initialized: boolean;

    static async init() {
        if(!this.initialized) {
            const txtConfig = SecretManager.loadSecureConfig();
            
            for(const key in txtConfig) {
                if(key.indexOf('DEPLOY.') === 0) {
                    DeployConfig[key.replace('DEPLOY.', '')] = txtConfig[key];
                }
                else {
                    Config[key] = txtConfig[key];
                }
            }
        }
    }

    private static loadSecureConfig() {
        const secureFilePath = __dirname + '/secure.config.json';
        return JSON.parse(fs.readFileSync(secureFilePath, 'utf8'));
    }
}