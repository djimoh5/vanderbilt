import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { ChecklistInstance } from '../../model/checklist-instance.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ChecklistInstanceRepository extends BaseRepository {
    constructor() {
        super('checklist_instance');
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ChecklistInstance> {
        return this.context.findOne({ propertyId, period });
    }

    save(instance: ChecklistInstance): Promise<ChecklistInstance> {
        return this.context.update({ propertyId: instance.propertyId, period: instance.period }, instance, null, { upsert: true });
    }
}
