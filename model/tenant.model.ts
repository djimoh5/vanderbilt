import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum TenantStatus { Active = 'active', Suspended = 'suspended' }

export class Tenant implements BaseModel {
    oid?: uniqueid;
    name: string;
    status: TenantStatus = TenantStatus.Active;
    createdAt: number;
}
