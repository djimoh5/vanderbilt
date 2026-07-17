//import { Common } from '../utility/common';
//import { AuditUser } from './audit.model';
import { authid } from './id.model';

export enum JobRunnerContext {
    Queue = 'queue',
    Script = 'script',
    App = 'app'
}

export interface IRunnable {
    name: string;
    run(context: {}): Promise<void>;
    onNext: Function;
    auditUserId: authid;
    runDate?: number;
}

export abstract class Job implements IRunnable {
    id: string;
    platformId: number;
    result: JobResult;
    runningContext: JobRunnerContext;
    emailTriggerService: any;
    errorEmails?: string[];

    onNext: Function;
    abstract run(context: { platformId?: number, data?: any });

    constructor(public name: string) {}

    done(result: JobResult) {
        this.result = result;
        console.log(this.name, 'completed with result:', JSON.stringify(result));
        this.onNext();
    }

    private _auditUserId: authid;

    set auditUserId(userId: authid){
        if (userId){
            this._auditUserId = userId;
        }
    }

    get auditUserId(): authid {
        return this._auditUserId;// || AuditUser.getJobUser(Common.camelCaseToWords(this.name).toLowerCase().replace(/ /g, '-'), this.runningContext || JobRunnerContext.App, this.platformId);
    }

    private _runDate: number;

    get runDate(): number {
        return this._runDate || Date.now();
    }

    set runDate(value: number) {
        this._runDate = value;
    }
}

export enum JobType {}

export interface JobResult {
    success: boolean;
    data?: any;
    msg?: string;
    suppressError?: boolean;
}

export interface JobQueueItem {
    id?: string;
    type: JobType;
    isPlatformSpecific: boolean;
    params?: string[];
    status?: JobStatus;
    data?: any;
    result?: any;
    _ts?: number;
    _tsu?: number;
    startAt?: number;
    priority?: JobPriority;
    creator?: string;
    updater?: string;

    //Used for re-processing failed items
    cloneFromId?: string;
    reQueueId?: string;
}

export enum JobStatus {
    Error = -1,
    Pending = 1,
    Success = 2,
    Processing = 3,
    OnHold = 4
}

export interface JobQueueFilter {
    id?: string;
    platformId?: number;
    status?: JobStatus;
    type?: JobType;
}

export enum JobPriority {
    High = 1,
    Normal = 2,
    Low = 3
}

export interface JobConfig {
    forceQueue?: boolean;
    reprocessOnError?: boolean;
    defaultPriority?: JobPriority;
}

export const JobConfigByType: { [key in  JobType]?: JobConfig } = {}