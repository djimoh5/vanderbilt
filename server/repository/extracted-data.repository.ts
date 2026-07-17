import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { ExtractedData } from '../../model/extracted-data.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ExtractedDataRepository extends BaseRepository {
    constructor() {
        super('extracted_data');
    }

    getById(extractedDataId: uniqueid): Promise<ExtractedData> {
        return this.context.findOne({ oid: extractedDataId });
    }

    getBySourceDocument(sourceDocumentId: uniqueid): Promise<ExtractedData> {
        return this.context.findOne({ sourceDocumentId });
    }

    // re-running extraction on the same document (e.g. after a prompt/model change) replaces the
    // prior result rather than accumulating duplicates
    save(data: ExtractedData): Promise<ExtractedData> {
        return this.context.update({ sourceDocumentId: data.sourceDocumentId }, data, null, { upsert: true });
    }
}
