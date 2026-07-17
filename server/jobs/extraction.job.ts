import { Bootstrap, Injectable } from '../config/bootstrap';
import { Job } from '../../model/job.model';

import { AIService } from '../service/ai/ai.service';
import { S3Service } from '../service/s3.service';
import { SourceDocumentRepository } from '../repository/source-document.repository';
import { ExtractedDataRepository } from '../repository/extracted-data.repository';

import { Config } from '../config/config';
import { xlsx } from '../lib/xlsx/xlsx.utility';

import { SourceDocument } from '../../model/source-document.model';
import { ExtractedData } from '../../model/extracted-data.model';
import { AIConversation, AIModel, ChatGPTResponseFormat } from '../../model/ai.model';
import { UniqueId, uniqueid } from '../../model/id.model';
import { Common } from '../../utility/common';

const RESPONSE_FORMAT: ChatGPTResponseFormat = {
    type: 'json_schema',
    json_schema: {
        name: 'extracted_data',
        schema: {
            type: 'object',
            properties: {
                fields: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            value: { type: 'string' },
                            confidence: { type: 'number' }
                        },
                        required: ['name', 'value', 'confidence'],
                        additionalProperties: false
                    },
                    minItems: 0
                },
                overallConfidence: { type: 'number' }
            },
            required: ['fields', 'overallConfidence'],
            additionalProperties: false
        },
        strict: true
    }
};

@Injectable()
@Bootstrap()
export class ExtractionJob extends Job {
    private sourceDocumentId: uniqueid;

    constructor(private aiService: AIService, private s3Service: S3Service, private sourceDocumentRepository: SourceDocumentRepository, private extractedDataRepository: ExtractedDataRepository) {
        super('ExtractionJob');
    }

    setSourceDocument(sourceDocumentId: uniqueid) {
        this.sourceDocumentId = sourceDocumentId;
    }

    async run(_context: { data?: any }) {
        try {
            const doc = await this.sourceDocumentRepository.getById(this.sourceDocumentId);
            if (!doc) {
                this.done({ success: false, msg: 'source document not found' });
                return;
            }

            const raw = await this.s3Service.getRawObjectByUrl(this.s3Service.buildUrl(doc.s3Key, Config.S3_BUCKET.CONTEXT));
            if (!raw.success) {
                this.done({ success: false, msg: 'could not fetch document from S3' });
                return;
            }

            const isExcel = (doc.contentType && doc.contentType.includes('spreadsheet')) || /\.xlsx?$/i.test(doc.originalFilename);
            const extracted = isExcel
                ? await this.extractFromExcel(raw.data.content as Buffer, doc)
                : await this.extractFromPdf(raw.data.content as Buffer, doc);

            await this.extractedDataRepository.save(extracted);
            this.done({ success: true, data: { extractedDataId: extracted.oid } });
        }
        catch (err) {
            this.done({ success: false, data: err, msg: err.message });
        }
    }

    private async extractFromExcel(buffer: Buffer, doc: SourceDocument): Promise<ExtractedData> {
        const sheets = xlsx.fileToWorksheets(buffer, true);
        const dump = sheets.map(s => `Sheet: ${s.sheet.name}\nHeaders: ${s.headers.join(', ')}\n${JSON.stringify(s.data)}`).join('\n\n');
        return this.callExtractionAI(dump, doc);
    }

    private async extractFromPdf(buffer: Buffer, doc: SourceDocument): Promise<ExtractedData> {
        // PDF path is hardcoded to ChatGPT - relies on ChatGPTService's file-content-block mapping
        const base64 = buffer.toString('base64');
        return this.callExtractionAI(null, doc, base64);
    }

    private async callExtractionAI(textDump: string, doc: SourceDocument, fileBase64?: string): Promise<ExtractedData> {
        const conversation = new AIConversation(doc.oid, {
            role: 'system',
            content: `Extract structured field data from this ${doc.docType} document. Return fields with a name, value, and confidence (0-1) for each.`
        });
        conversation.add({
            role: 'user',
            content: fileBase64 ? [{ type: 'file', file: fileBase64 }] : textDump
        });

        // PDF path is forced to ChatGPT regardless of the Excel-path default; Excel model choice is a tunable default
        const model: AIModel = fileBase64 ? 'gpt-5.4' : 'gpt-5.4-mini';
        const message = await this.aiService.executeConversation(conversation, { model, responseFormat: RESPONSE_FORMAT }, doc.uploadedBy);

        const extracted = new ExtractedData();
        extracted.oid = UniqueId(Common.uniqueId());
        extracted.propertyId = doc.propertyId;
        extracted.sourceDocumentId = doc.oid;
        extracted.period = doc.period;
        extracted.docType = doc.docType;
        extracted.fields = message.json?.fields || [];
        extracted.overallConfidence = message.json?.overallConfidence || 0;
        extracted.extractedAt = Date.now();
        extracted.aiModel = model;
        return extracted;
    }
}
