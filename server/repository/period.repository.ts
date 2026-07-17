import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { Period } from '../../model/period.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PeriodRepository extends BaseRepository {
    constructor() {
        super('period');
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<Period> {
        return this.context.findOne({ propertyId, period });
    }

    save(p: Period): Promise<Period> {
        return this.context.update({ propertyId: p.propertyId, period: p.period }, p, null, { upsert: true });
    }
}
