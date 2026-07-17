import { Operations, UpdateOptions, SortOrder } from "./operations";
import { PaginationModel } from "../../model/shared.model";
import { Filter } from 'mongodb';
import { DatabaseConnection } from './database';

export interface IDatabaseContext {
    isConnected(): boolean;

    find(query: Filter<any>, fields?: { [key: string]: 1 | 0 }, operations?: Operations, mapper?: (data: any) => any): Promise<any[]>;

    findOne(query: Filter<any>, fields?: { [key: string]: 1 | 0 }, isPlatformAgnostic?: boolean): Promise<any>;

    findIds(ids: string[], fields?: { [key: string]: 1 | 0 }, operations?: Operations, searchField?: string, mapper?: (data: any) => any): Promise<any[]>;

    insert(data: any, auditUserId: string): Promise<any>;

    update(query: Filter<any>, data: any, auditUserId: string, options?: UpdateOptions, isPlatformAgnostic?: boolean): Promise<any>;

    append(query: Filter<any>, data: any, auditUserId: string, isPlatformAgnostic?: boolean): Promise<any>;

    remove(query: Filter<any>, auditUserId: string): Promise<boolean>;

    count(query: Filter<any>, isPlatformAgnostic?: boolean): Promise<number>;

    sum(query: Filter<any>, sumField: string, groupByField: string): Promise<{ _id: string, sum: number }[]>;

    max(query: Filter<any>, maxField: string, groupByField: string): Promise<any[]>;

    page<T>(query: Filter<any>, pageNumber: number, pageSize: number, fields?: { [key: string]: 1 | 0 }, mapper?: (data: any) => T, sorter?: {[key: string]: SortOrder}): Promise<PaginationModel<T>>;

    distinct(field: string, query: Filter<any>): Promise<any[]>;

    onConnect(): Promise<boolean>;

    waitForAuditLog(): Promise<void>;
}

export interface IDatabaseContextOptions {
    tenantId?: string;
    searchGlobalObjects?: boolean;
    disableAuditLogs?: boolean;
    connection?: DatabaseConnection;
    explicitConnection?: boolean;
}