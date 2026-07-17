import { environment } from '../../environments/environment';

export class Config {
    static CacheVersion = '1.0';
    static CacheExpiration: number = 600;
    static BaseUrl: string = '';
    static ApiUrl: string = environment.apiUrl;
    static IsMobile: boolean;
    static AppCrashed: boolean;
    static ShowErrors: boolean = true;
    static ShowSidenav: boolean = false;
    static Initialized: boolean;
    static SuppressAPILogging: boolean = true;

    static GOOGLE_MAPS_CLIENT_API_KEY = 'AIzaSyBDioqiYBfhA57c3o6--Q_WiWB3NPv87tM';
    static GOOGLE_OAUTH_CLIENT_ID = '113067891882-r1h87oc67gqi6via2esek59u65rcef63.apps.googleusercontent.com';
}