import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { Property, PropertyRole, PropertyRoleType } from 'bundle/model';

@Injectable()
export class PropertyService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getAll(): Promise<ApiResponse<Property[]>> {
        return this.get('property');
    }

    create(name: string, yardiCode?: string): Promise<ApiResponse<Property>> {
        return this.post('property', { name, yardiCode });
    }

    assignRole(propertyId: string, userId: string, role: PropertyRoleType): Promise<ApiResponse<PropertyRole>> {
        return this.post(`property/${propertyId}/role`, { userId, role });
    }
}
