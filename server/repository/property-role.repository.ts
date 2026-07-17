import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { PropertyRole } from '../../model/property.model';
import { authid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PropertyRoleRepository extends BaseRepository {
    constructor() {
        super('property_role');
    }

    getByUser(userId: authid): Promise<PropertyRole[]> {
        return this.context.find({ userId });
    }

    save(role: PropertyRole): Promise<PropertyRole> {
        return super.updateObject(role);
    }
}
