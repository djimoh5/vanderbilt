import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum PropertyStatus { Active = 'active', Inactive = 'inactive' }

export class Property implements BaseModel {
    oid?: uniqueid;
    name: string;
    yardiCode?: string;      // e.g. 'pbnor001'
    address?: string;
    squareFootage?: number;
    status: PropertyStatus = PropertyStatus.Active;
    createdAt: number;
}

export enum PropertyRoleType { Accountant = 'accountant', Reviewer = 'reviewer', Admin = 'admin' }

export class PropertyRole implements BaseModel {
    oid?: uniqueid;
    userId: authid;
    propertyId?: uniqueid; // omitted = tenant-wide role (e.g. tenant Admin)
    role: PropertyRoleType;
    createdAt: number;
}
