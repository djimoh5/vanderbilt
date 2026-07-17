import { Bootstrap, Injectable } from '../config/bootstrap';
import { PropertyRepository } from '../repository/property.repository';
import { PropertyRoleRepository } from '../repository/property-role.repository';

import { ApiResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { Property, PropertyRole, PropertyRoleType } from '../../model/property.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class PropertyService extends BaseService {
    constructor(appService: AppService, private propertyRepository: PropertyRepository, private propertyRoleRepository: PropertyRoleRepository) {
        super(appService);
    }

    async create(name: string, yardiCode?: string): Promise<ApiResponse<Property>> {
        const property = new Property();
        property.oid = UniqueId(Common.uniqueId());
        property.name = name;
        property.yardiCode = yardiCode;
        property.createdAt = Date.now();

        await this.propertyRepository.save(property);
        return new ApiResponse(true, property);
    }

    getAll(): Promise<Property[]> {
        return this.propertyRepository.getAll();
    }

    async assignRole(propertyId: uniqueid, userId: authid, role: PropertyRoleType): Promise<ApiResponse<PropertyRole>> {
        const propertyRole = new PropertyRole();
        propertyRole.oid = UniqueId(Common.uniqueId());
        propertyRole.propertyId = propertyId;
        propertyRole.userId = userId;
        propertyRole.role = role;
        propertyRole.createdAt = Date.now();

        await this.propertyRoleRepository.save(propertyRole);
        return new ApiResponse(true, propertyRole);
    }
}
