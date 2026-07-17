import { AppService } from './app.service';

const util = require('util');

export abstract class BaseService {
    private _serviceId: string;
    get serviceId(): string { return this._serviceId; }
    static nextServiceId: number = 0;

    constructor(protected appService: AppService, serviceId?: string) {
        this._serviceId = serviceId || `s${++BaseService.nextServiceId}`;
    }

    protected log(msg: any) {
        console.log(this.getLog(msg));
    }

    protected getLog(msg: any) {
        return util.inspect(msg, { depth: null });
    }
}

export class ApiResponse<T> {
    constructor(public success: boolean, public data?: T, public msg?: string) {}
}

export class ApiErrorResponse extends ApiResponse<null> {
    constructor(msg: string) {
        super(false, null, msg)
    }
}