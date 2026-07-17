import { ErrorLogRepository } from "../repository/error-log.repository";
import { ErrorType } from '../../model/error.model';
import { Bootstrap, Injectable } from "../config/bootstrap";

import { inspect } from 'util';
import * as querystring from 'querystring';
import { Common } from "../../utility/common";
import { authid } from "../../model/id.model";

@Injectable()
@Bootstrap()
export class ErrorService {
    private static errorLogRepository: ErrorLogRepository;
    private static error_depth: number = 10;

    constructor(errorLogRepository: ErrorLogRepository) {``
        ErrorService.errorLogRepository = errorLogRepository;
    }

    static log(err: any, type: ErrorType, authId?: authid, data?: any) {
        console.log("Log err", err);
        if (ErrorService.errorLogRepository) {
            ErrorService.errorLogRepository.add(err.stack ? err : new Error(err), type, authId, data);
        }
    }

    log(err: any, type: ErrorType, authId?: authid, data?: any) {
        ErrorService.log(err, type, authId, data);
    }

    waitForConnection() {
        return ErrorService.errorLogRepository.waitForConnection();
    }

    convertToObject(exp: any, data?: any, cleanupStack: boolean = true) {
        ErrorService.convertToObject(exp, data, cleanupStack);
    }

    static convertToObject(exp: any, data?: any, cleanupStack: boolean = true) {
        let error: any = inspect(exp, { depth: this.error_depth }) || {};

        if (Common.isArray(exp)) {
            const errors: Error[] = exp.map(ex => this.convertToObject(ex));
            if (errors.length > 0) {
                error = {
                    stack: new Error().stack,
                    errors: errors,
                    message: `Multiple Errors: ${errors.map(err => err.message).join(' | ')}`
                };
            }
            else {
                error = {
                    stack: new Error().stack,
                    message: `Empty Array`
                };
            }
        }
        else if (typeof (exp) === 'object') {
            const customData: any = exp;//this.prettyError(exp, false);

            error = {
                ...customData,
                message: this.findMessage(customData) || this.findMessage(customData.error, 0, 'error') || customData.stack.split('\n')[0]
            };
        }
        else if (typeof (exp) === 'string' || typeof (exp) === 'undefined') {
            try {
                if (exp && exp.includes('{')) {
                    return this.convertToObject(JSON.parse(exp), data);
                }
            }
            catch (e) {
                console.log("Parse Error:", e);
            }
            error = {
                stack: new Error().stack,
                message: typeof (exp) === 'undefined'? 'Unknown Error' : exp
            };
        }
        else {
            error = {
                stack: new Error().stack,
                message: exp
            };
        }

        if (cleanupStack) {
            error.stack = this.cleanupStack(error.stack);
        }

        if (data) {
            error.data = this.sanitizeData(this.keysToClear, data);
        }

        error.message = this.sanitizeText(error.message);

        return error;
    }

    static findMessage(data: any, depth: number = 0, messageKey: string = null, specificKeyOnly: boolean = false, stringOnly?: boolean) {
        if (depth > 4){
            return null;
        }
        if (!data){
            return null;
        }
        if (messageKey) {
            const message = data[messageKey];
            if (message) {
                if (typeof message === 'object') {
                    const found = this.findMessage(message, depth, messageKey, false, stringOnly);
                    if (!Common.isNullOrUndefined(found)){
                        return found;
                    }
                }
                if (stringOnly) {
                    if (typeof message === 'string') {
                        return message;
                    }
                }
                else {
                    return this.convertToText(data[messageKey]);
                }
            }
        }
        if (!specificKeyOnly && (data.message || data.msg)) {
            return data.message || data.msg;
        }

        ++depth;
        
        for(const key in data){
            const value = data[key];
            //properties like failure_message or error_message
            const lookupKey = key.toLowerCase();
            if ((!messageKey && lookupKey.includes('message')) || (messageKey && !specificKeyOnly && lookupKey.includes(messageKey))) {
                if (typeof value === 'object') {
                    const found = this.findMessage(value, depth, messageKey, false, stringOnly);
                    if (!Common.isNullOrUndefined(found)){
                        return found;
                    }
                }
                if (stringOnly) {
                    if (typeof value === 'string') {
                        return value;
                    }
                }
                else {
                    return this.convertToText(value);
                }
            }
            if (typeof(value) === 'object'){
                const found = this.findMessage(value, depth, messageKey, specificKeyOnly, stringOnly);
                if (!Common.isNullOrUndefined(found)){
                    return found;
                }
            }
        }

        return null;
    }

    static stackFilterKeys = ['ErrorService.convertToObject', 'ErrorService.convertHttp', 'ErrorsUtility.', '\/errors.utility.', '\\errors.utility.', '(node:internal\/', '(node:internal\\', '(node:events:', '(node:domain:', 'node_modules\/request\/', 'node_modules\\request\\', 'node_modules\/ts-node\/', 'node_modules\\ts-node\\'];
    static cleanupStack(stack: string) {
        if (stack && typeof stack === 'string') {
            return stack.split('\n').filter(line => !this.stackFilterKeys.some(key => line.includes(key))).join('\n');
        }
        return stack;
    }

    static jsonStringify(obj: any) {
        return JSON.stringify(obj, refReplacer());
    }

    static convertToText(data: any) {
        let out: string = '';
        try {
            out = typeof data === 'string'? data : Common.isArray(data)? data.map(d => this.convertToText(d)).join(' | ') : typeof data === 'object' ? this.jsonStringify(data) : `${data}`;
        }
        catch (e) {
            out = inspect(data, { depth: this.error_depth });
        }

        return out? out.replace(/(u0026nbsp;[ ]*)|(^\n)/g, '') : out;
    }

    static doubleNewLines = /\n\n/g;
    static userPasswordURLRegex = /(\/\/([^:]*):)([^@]*)@/g;
    static truncateLimitMap = { 'attachments': 200 };
    static keysToClear = ['Authorization', 'authorization', 'password', 'securityKey', 'merchantAuthentication', 'Token', 'data_uri', 'access_token', 'ssn', 'taxId', 'ssoAuth', 'oauthCode', 'refresh_token'];
    static sanitizeData(secureKeys: string[], dataToSanitize: any) {
        if (dataToSanitize && typeof dataToSanitize === 'object') {
            //deep copy of all data for keeping changes to this method only
            const cloneData = JSON.parse(JSON.stringify(dataToSanitize));

            const truncate = (data: any, key: string, truncateLimit: number) => {
                if (data && data[key] && typeof data[key].slice === 'function' && typeof data !== 'string') {
                    const length = data[key].length;
                    data[key] = data[key].slice(0, truncateLimit);

                    if (length && length >= truncateLimit && typeof data[key] === 'string') {
                        data[key] += `...@${length}`;
                    }
                }

                if (data && data[key] && data[key].type === 'Buffer' && data[key].data) {
                    data[key].data = ['file data removed'];
                }
            };

            const sanitizeDataKey = (data: any, key: string) => {
                if (typeof data[key] === 'object' || Common.isArray(data[key])) {
                    for (const subKey in data[key]) {
                        sanitizeDataKey(data[key], subKey);
                    }
                }
                else if (data[key] && data[key].length) {
                    data[key] = `${Common.passwordMask}-${data[key].length}`;
                }
                else {
                    data[key] = Common.passwordMask;
                }
            };

            const checkFields = (data: any, key: string, truncateLimit: number) => {
                if (this.truncateLimitMap[key]) {
                    truncateLimit = this.truncateLimitMap[key];
                }
                if (data && data[key] && typeof data !== 'string' && typeof data[key] === 'string') {
                    if (data[key].includes('=') && !data[key].includes('{')) {
                        try {
                            const original = '' + data[key];
                            let url = '';
                            if (original.includes('?')) {
                                url = original.substring(0, original.indexOf('?') + 1);
                                data[key] = original.substring(original.indexOf('?') + 1);
                            }
                            const dataQuery = querystring.parse(data[key]);
                            if (dataQuery) {
                                for (const subKey in dataQuery) {
                                    checkFields(dataQuery, subKey, truncateLimit);
                                }
                                data[key] = url + querystring.stringify(dataQuery);
                            }
                        }
                        catch (e) {
                        }
                    }

                    data[key] = this.sanitizeText(data[key]);
                }

                //this is a secure url: http://username:password@domain.com
                if (data && data[key] && typeof data !== 'string' && typeof data[key] === 'string' && data[key].match(this.userPasswordURLRegex)) {
                    if (secureKeys && secureKeys.includes('url.username')) {
                        data[key] = data[key].replace(this.userPasswordURLRegex, `//${Common.passwordMask}:${Common.passwordMask}@`);
                    }
                    else {
                        data[key] = data[key].replace(this.userPasswordURLRegex, `$1${Common.passwordMask}@`);
                    }
                }

                if (data && data[key] && typeof data !== 'string') {
                    truncate(data, key, truncateLimit);
                    for (const subKey in data[key]) {
                        if (data[key].hasOwnProperty(subKey)) {
                            checkFields(data[key], subKey, truncateLimit);
                        }
                    }
                }

                const isSecureKey = this.keysToClear.includes(key) || (secureKeys && secureKeys.includes(key));
                if (data && isSecureKey) {
                    sanitizeDataKey(data, key);
                }
            };

            for (const key in cloneData) {
                if (cloneData.hasOwnProperty(key)) {
                    checkFields(cloneData, key, 2000);
                }
            }

            return cloneData;
        }

        return dataToSanitize;
    }

    private static sanitizeText(text: string) {
        if (!text || typeof text !== 'string') {
            return text;
        }
        let res = text.replace(/  /g, '').replace(/\\n/g, ' ');
        while (this.doubleNewLines.test(res)) {
            res = res.replace(this.doubleNewLines, '\n');
        }
        return res;
    }
}

function refReplacer() {
    const m = new Map(), v = new Map();
    let init = null;

    return function (this: any, field: string, value: any) {
        const p = m.get(this) + (Array.isArray(this) ? `[${field}]` : '.' + field);
        const isComplex = value === Object(value);

        if (isComplex) {
            m.set(value, p);
        }

        const pp = v.get(value) || '';
        const path = p.replace(/undefined\.\.?/, '');
        let val = pp ? `#REF:${pp[0] == '[' ? '$' : '$.'}${pp}` : value;

        !init ? (init = value) : (val === init ? val = "#REF:$" : 0);
        if (!pp && isComplex) {
            v.set(value, path);
        }

        return val;
    };
}