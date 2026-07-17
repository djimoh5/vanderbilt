import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { PropertyRole } from '../../model/property.model';
import { authid, uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PropertyRoleRepository extends BaseRepository {
    constructor() {
        super('property_role');
    }

    getByUser(userId: authid): Promise<PropertyRole[]> {
        return this.context.find({ userId });
    }

    getByProperty(propertyId: uniqueid): Promise<PropertyRole[]> {
        return this.context.find({ propertyId });
    }

    save(role: PropertyRole): Promise<PropertyRole> {
        return super.updateObject(role);
    }
}
