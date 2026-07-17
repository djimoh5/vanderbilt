export class BaseConfig {
    static ENVIRONMENT = 'dev';
    static APP_NAME = 'APP_NAME';

    static SERVER_NAME = 'local';
    static SERVER_PORT = 8080;
    static REMOTE_SERVER_PORT = 3000;
    static FORCE_ENABLE_CONSOLE_LOG = false;
    static LOAD_BALANCED_REQUEST = false;

    static RUN_TIME: number = null;
    static DATABASE_MAINTENANCE_MODE: boolean = false;

    static APP_API_SECRET = '';

    static MONGO_CONNECTIONS = {
        APP: { ip: '127.0.0.1:27017', db: 'vanderbilt', user: '', password: '' },
        AUDIT: { ip: '127.0.0.1:27017', db: 'vanderbilt', user: '', password: '' },
        LOG: { ip: '127.0.0.1:27017', db: 'vanderbilt', user: '', password: '' },
        WAREHOUSE: { ip: '127.0.0.1:27017', db: 'vanderbilt', user: '', password: '' },
    };

    static EMAIL = {
        tag: 'app_name',
        from: 'vanderbilt@secondfriday.ai',
        fromName: 'Vanderbilt - Second Friday',
        admin: ['deji@secondfriday.ai']
    }

    static RATE_LIMIT = {
        SKIP_TOKEN: `TOKEN_LIMITER_KQGmnq8vwrKjmx9nDWpQ`,
        ATTEMPTS: 3,
        TIME_LIMIT: 10000
    };

    static APP_INDEX_PAGE = '/dist/index.html';
    static APP_URL = '';

    /*** ACCESS KEYS ***/
    static OPEN_AI_KEY = '';
    static GEMINI_API_KEY = '';
    static CLAUDE_API_KEY = '';
    
    static MANDRILL_API_KEY = '';
    static MANDRILL = {
        API_URL: 'https://mandrillapp.com/api/1.0'
    };

    static AWS_ACCESS_KEY = '';
    static AWS_ACCESS_SECRET = '';

    static AWS_LAMBDA_ACCESS_KEY = '';
    static AWS_LAMBDA_ACCESS_SECRET = '';

    static S3_BUCKET = {
        CONTEXT: 'vanderbilt-context'
    }

    static SERVERLESS = false;
}