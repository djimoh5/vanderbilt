import { authid } from './id.model';

export enum ErrorType {
    CaughtException = 1,
    UncaughtException = 2,
    HandledRejection = 3,
    UnhandledRejection = 4,
    HttpError = 5,
    HttpSuccess = 6,
    UIException = 7,
    ContentSecurityPolicy = 8,
    Unauthorized = 9,
    ModelValidation = 10
}

export interface Exception {
    id: string;
    exception: any;
    date: number;
    type: ErrorType;
    _p?: number[];
    _u?: authid;
    version?: string;
}

export interface UIException {
    url?: string;
    message: string;
    error: any;
    data?: any;
    version?: string;

    //virtual
    options?: any;
}

export class ExceptionLog {
    level: number;
    timestamp: string;
    fileName: string;
    lineNumber: string;
    additional?: any[];
    _p?: number[];
}

export class ContentSecurityPolicyLog {
    "csp-report": {
        "blocked-uri": string,
        "disposition": string,
        "document-uri:": string,
        "effective-directive": string,
        "original-policy": string,
        "referrer": string,
        "script-sample": string,
        "status-code:": string,
        "violated-directive": string,
    };
}