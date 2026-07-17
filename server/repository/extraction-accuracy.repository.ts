import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { ExtractionAccuracy } from '../../model/extraction-accuracy.model';

@Injectable()
@Bootstrap()
export class ExtractionAccuracyRepository extends BaseRepository {
    constructor() {
        super('extraction_accuracy');
    }

    save(log: ExtractionAccuracy): Promise<ExtractionAccuracy> {
        return super.updateObject(log);
    }
}
