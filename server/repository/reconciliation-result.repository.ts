import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { ReconciliationResult } from '../../model/reconciliation-result.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ReconciliationResultRepository extends BaseRepository {
    constructor() {
        super('reconciliation_result');
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ReconciliationResult[]> {
        return this.context.find({ propertyId, period });
    }

    getByExtractedData(extractedDataId: uniqueid): Promise<ReconciliationResult> {
        return this.context.findOne({ extractedDataId });
    }

    // re-running reconciliation on the same extracted document replaces the prior result, not duplicates
    save(result: ReconciliationResult): Promise<ReconciliationResult> {
        return this.context.update({ extractedDataId: result.extractedDataId }, result, null, { upsert: true });
    }
}
