import { uniqueid } from './id.model';

export interface BaseModel {
    oid?: uniqueid;
}

export interface GenericMap<T> { 
    [key: string]: T;
}

export class ApiResponse<T> {
    constructor(public success: boolean, public data?: T, public msg?: string) {}
}

export class ApiErrorResponse extends ApiResponse<null> {
    constructor(public override msg: string) {
        super(false, null, msg)
    }
}

export class PaginationModel<T> {
    results: T[];
    page: number;
    pageSize: number;
    totalItems: number;
}

export function Virtual() {
    return (target: any, propertyKey: string) => {
        if(!target['_virtualProperties']) {
            target['_virtualProperties'] = [];
        }

        target['_virtualProperties'].push(propertyKey);
    }
}