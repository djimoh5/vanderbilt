import { Database, DatabaseConnection } from '../database/database';
import { DatabaseContext } from '../database/context';
import { IDatabaseContext, IDatabaseContextOptions } from '../database/icontext';

import { DeployConfig } from '../config/deploy.config';
import { Common } from '../../utility/common';
import { BaseModel, GenericMap } from '../../model/shared.model';

export interface RepositoryOptions {
    searchGlobalObjects?: boolean;
    disableAuditLogs?: boolean;
    connection?: DatabaseConnection;
    explicitConnection?: boolean;
}

export abstract class BaseRepository {
    protected context: IDatabaseContext;
    protected tenantId: string;
    protected contextOptions: IDatabaseContextOptions;

    constructor(private collectionName: string, options: RepositoryOptions = {}) {
        this.tenantId = DeployConfig.INJECTED_TENANT_ID;
        this.context = this.createContext(options, collectionName);
    }

    get name() {
        return this.collectionName;
    }

    get options() {
        return this.contextOptions;
    }

    protected createContext(options: RepositoryOptions, collectionName: string) {
        this.contextOptions = {
            tenantId: this.tenantId,
            searchGlobalObjects: options.searchGlobalObjects,
            disableAuditLogs: options.disableAuditLogs,
            explicitConnection: options.explicitConnection,
            connection: options.connection || DatabaseConnection.APP
        };

        return new DatabaseContext(collectionName, this.contextOptions);
    }

    protected dbObjectId(oid: string) {
        if (oid && !Common.isMongoId(oid)){
            throw new Error(`Provided ID: ${oid} on ${this.collectionName} not valid mongoDB ID`);
        }

        return Database.ObjectID(oid);
    }

    getByObjectId<T>(oid: string): Promise<T> {
        return this.context.findOne({ oid: oid });
    }

    getByObjectIds<T>(oids: string[]): Promise<T[]> {
        return this.context.find({ oid: { $in: oids } });
    }

    updateObject<T>(obj: BaseModel, optionalParams?: GenericMap<any>): Promise<T> {
        if(obj['_virtualProperties']) { //doesn't work because value fron front-end is json not a class instance anymore
            for(let key of obj['_virtualProperties']) {
                delete obj[key];
            }

            delete obj['_virtualProperties'];
        }

        const params = optionalParams ? { oid: obj.oid, ...optionalParams } : { oid: obj.oid };
        return this.context.update(params, obj, null, { upsert: true });
    }

    removeObject(oid: string): Promise<boolean> {
        return this.context.remove({ oid: oid }, null);
    }

    protected mapData<T>(mapper: (data: any) => T, data: any) {
        const mapData: T[] = [];
        for(let i = 0, d: any; d = data[i]; i++) {
            mapData.push(mapper(d));
        }

        return mapData;
    }

    async waitForAuditLog() {
        return this.context.waitForAuditLog();
    }
}