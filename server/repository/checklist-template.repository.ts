import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { SortOrder } from '../database/operations';
import { ChecklistTemplate } from '../../model/checklist-template.model';

@Injectable()
@Bootstrap()
export class ChecklistTemplateRepository extends BaseRepository {
    constructor() {
        // tenant-agnostic reference data, same as ChartOfAccountRepository's isTemplate rows -
        // searchGlobalObjects lets a real tenant's query still match the seeded rows (which carry
        // no _tid at all)
        super('checklist_template', { searchGlobalObjects: true });
    }

    getAll(): Promise<ChecklistTemplate[]> {
        return this.context.find({}, null, { sort: { order: SortOrder.Ascending } });
    }
}
