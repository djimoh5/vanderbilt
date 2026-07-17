import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';
import { DocType } from './source-document.model';
import { AIModel } from './ai.model';

export interface ExtractedField {
    name: string;
    value: string | number;
    confidence: number; // 0-1
}

export class ExtractedData implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    sourceDocumentId: uniqueid;
    period: string;              // 'YYYY-MM', propagated from SourceDocument at extraction time
    docType: DocType;
    fields: ExtractedField[];
    overallConfidence: number;
    extractedAt: number;
    aiModel: AIModel;
}
