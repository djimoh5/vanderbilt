import { BaseConfig } from './config.base';
import { DeployConfig } from './deploy.config';
import { Config as ReleaseConfig } from './config.release';
import { Config as QAConfig } from './config.qa';
import { Config as SprintConfig } from './config.sprint';

export let Config = BaseConfig;

declare let process: any;

export function setConfig(_argv: string[]) {
    for(let i = 0, arg; arg = argv[i]; i++) {
        if(arg === '--release') {
            Config = ReleaseConfig;
        }
        else if(arg === '--qa') {
            Config = QAConfig;
        }
        else if(arg === '--sprint') {
            Config = SprintConfig;
        }
        else if(arg === '--domain' && argv[i + 1]) {
            DeployConfig.DOMAIN = argv[i + 1];
        }
        else if(arg === '--bucket' && argv[i + 1]) {
            DeployConfig.BUCKET = argv[i + 1];
        }
        else if(arg === '--log') {
            Config.FORCE_ENABLE_CONSOLE_LOG = true;
        }
    }

    if(Config.ENVIRONMENT !== 'dev') {
        Config.SERVER_PORT = Config.REMOTE_SERVER_PORT;
    }

    if(process.env.CONFIG) {
        const secret = JSON.parse(process.env.CONFIG);
        for(const key in secret) {
            Config[key] = secret[key];
        }
    }

    if(process.env.DEPLOY_CONFIG) {
        const secret = JSON.parse(process.env.DEPLOY_CONFIG);
        for(const key in secret) {
            DeployConfig[key] = secret[key];
        }
    }

    if((Config.ENVIRONMENT === 'release' || Config.ENVIRONMENT === 'demo') && !Config.FORCE_ENABLE_CONSOLE_LOG) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        console.log = () => {};
    }

    console.log('environment:', Config.ENVIRONMENT, 'injected platform:', DeployConfig.INJECTED_TENANT_ID);
}

const argv = (<string[]>process.argv).slice(2);

if(process.env.ENVIRONMENT) {
    argv.push('--' + process.env.ENVIRONMENT); 
}

setConfig(argv);