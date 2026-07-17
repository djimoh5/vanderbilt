import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { Property } from '../../model/property.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PropertyRepository extends BaseRepository {
    constructor() {
        super('property');
    }

    getAll(): Promise<Property[]> {
        return this.context.find({});
    }

    getById(propertyId: uniqueid): Promise<Property> {
        return this.context.findOne({ oid: propertyId });
    }

    save(property: Property): Promise<Property> {
        return super.updateObject(property);
    }
}
