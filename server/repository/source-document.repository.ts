import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { SortOrder } from '../database/operations';
import { SourceDocument, DocType } from '../../model/source-document.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class SourceDocumentRepository extends BaseRepository {
    constructor() {
        super('source_document');
    }

    getById(docId: uniqueid): Promise<SourceDocument> {
        return this.context.findOne({ oid: docId });
    }

    async getLatestByPropertyPeriodType(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument> {
        const results = await this.context.find({ propertyId, period, docType }, null, { sort: { version: SortOrder.Descending }, limit: 1 });
        return results[0];
    }

    getVersionHistory(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument[]> {
        return this.context.find({ propertyId, period, docType }, null, { sort: { version: SortOrder.Descending } });
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<SourceDocument[]> {
        return this.context.find({ propertyId, period });
    }

    save(doc: SourceDocument): Promise<SourceDocument> {
        return super.updateObject(doc);
    }
}
