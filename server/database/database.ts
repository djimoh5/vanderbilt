declare var require: any;
import { Config } from '../config/config';
import { Common } from '../../utility/common';
import { Db } from 'mongodb';
export { Collection, IndexSpecification } from 'mongodb';

import { MongoClient } from 'mongodb';
import { AuditLogData } from '../../model/audit.model';

export class Database {
    private static mongo: { [db: string]: Db } = {};
    private static openPromises: { [db: string]: Promise<boolean> } = {};
    private static requested: DatabaseConnection[] = [];

    static ObjectID = require('mongodb').ObjectId;

    static getPromise(type: DatabaseConnection = DatabaseConnection.APP) {
        Database.addToRequest(type);
        const connection = Database.getConnection(type);
        return Database.openPromises[Database.getConnectionKey(connection)];
    }

    static getMongo(type: DatabaseConnection = DatabaseConnection.APP) {
        Database.addToRequest(type);
        const connection = Database.getConnection(type);
        const connectionKey = Database.getConnectionKey(connection);
        return Database.mongo[connectionKey];
    }

    static getAllUniqueConnections() {
        const types = [DatabaseConnection.APP, DatabaseConnection.AUDIT, DatabaseConnection.LOG];
        const keys = {};
        const connections: { type: DatabaseConnection, connectionKey: string }[] = [];

        for (let index = 0; index < types.length; index++) {
            const type = types[index];
            const connection = Database.getConnection(type);
            const connectionKey = Database.getConnectionKey(connection);

            if (!keys[connectionKey]) {
                connections.push({ type: type, connectionKey: connectionKey });
            }
        }
        
        return connections;
    }

    static open(type: DatabaseConnection = DatabaseConnection.APP, forced?: boolean): Promise<boolean> {
        if(Config.DATABASE_MAINTENANCE_MODE) {
            return Promise.resolve(null);
        }

        Database.addToRequest(type);
        const connection = Database.getConnection(type);
        const connectionKey = Database.getConnectionKey(connection);

        if(!Database.openPromises[connectionKey] || forced) {
            Database.openPromises[connectionKey] = new Promise(async resolve => {
                try {
                    const auth = connection.password ? `${connection.user}:${connection.password}@` : '';
                    const client = new MongoClient(`${connection.ip.includes(':') ? 'mongodb' : 'mongodb+srv'}://${auth}${connection.ip}/${connection.db}`, { w: 1, ignoreUndefined: true });

                    await client.connect();
                    
                    Database.mongo[connectionKey] = client.db();
                    for (let index = 0; index < Database.requested.length; index++) {
                        const loadedType = Database.requested[index];
                        
                        const loadedConnection = Database.getConnection(loadedType);
                        const loadedConnectionKey = Database.getConnectionKey(loadedConnection);

                        if (connectionKey === loadedConnectionKey) {
                            console.log(`${loadedType} DB connected`, connection.ip, connection.db);
                        }
                    }
                    resolve(true);
                }
                catch(e) {
                    console.log(`Error occurred connecting to ${type} DB`, connection, e);
                    resolve(false);
                }
            });
        }

        return Database.openPromises[connectionKey];
    }

    static openAll(connections: DatabaseConnection[]) {
        return Promise.all(connections.map(type => Database.open(type)));
    }

    static getConnection(type?: DatabaseConnection) {
        if (!Config.MONGO_CONNECTIONS[type]) {
            return Config.MONGO_CONNECTIONS.APP;
        }

        return Config.MONGO_CONNECTIONS[type];
    }

    private static getConnectionKey(connection: { db: string, ip: string }) {
        return Common.hashCode(connection.db + connection.ip);
    }

    private static addToRequest(type: DatabaseConnection){
        if (!Database.requested.includes(type)){
            Database.requested.push(type);
        }
    }
}

export interface QueryResults {
    (err: any, results: any);
}

//TODO: Find out why adding `& { auditId: string }` is impacting the type AuditLogData
export type AuditModel<T> = {
    [K in keyof T]: any;
} & AuditLogData;

export class DBModel {
    _id?: any;
    _ts?: number;
    _p?: number[];
    _u?: string;

    //Audit properties
    og_id?: any;
    _tsu?: number;
    _uu?: string;
    _m?: boolean; //migrated

    //DB Warehouse
    _s?: boolean; //sanitized

    public constructor(id?: string, init?: Partial<DBModel>) {
        if(id) {
            this._id = new Database.ObjectID(id);
        }

        for(let key in init) {
            if(typeof init[key] !== 'undefined') {
                this[key] = init[key];
            }
        }
    }
}

export enum DatabaseConnection {
    APP = 'APP',
    AUDIT = 'AUDIT',
    LOG = 'LOG',
    WAREHOUSE = 'WAREHOUSE',
    VEILLANCE = 'VEILLANCE'
}