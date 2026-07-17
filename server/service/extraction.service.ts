import { Bootstrap, Injectable } from '../config/bootstrap';
import { ExtractedDataRepository } from '../repository/extracted-data.repository';

import { BaseService } from './base.service';
import { AppService } from './app.service';

import { ExtractedData } from '../../model/extracted-data.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ExtractionService extends BaseService {
    constructor(appService: AppService, private extractedDataRepository: ExtractedDataRepository) {
        super(appService);
    }

    getBySourceDocument(sourceDocumentId: uniqueid): Promise<ExtractedData> {
        return this.extractedDataRepository.getBySourceDocument(sourceDocumentId);
    }
}
