import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { TrialBalanceSnapshot } from '../../model/trial-balance.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class TrialBalanceRepository extends BaseRepository {
    constructor() {
        super('trial_balance_snapshot');
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<TrialBalanceSnapshot> {
        return this.context.findOne({ propertyId, period });
    }

    // a re-import for the same property+period overwrites the prior snapshot rather than versioning it
    save(snapshot: TrialBalanceSnapshot): Promise<TrialBalanceSnapshot> {
        return this.context.update({ propertyId: snapshot.propertyId, period: snapshot.period }, snapshot, null, { upsert: true });
    }
}
