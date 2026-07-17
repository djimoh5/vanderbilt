import { Bootstrap, Injectable } from '../config/bootstrap';
import { SourceDocumentRepository } from '../repository/source-document.repository';
import { S3Service } from './s3.service';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';
import { Config } from '../config/config';

import { SourceDocument, DocType } from '../../model/source-document.model';
import { S3UploadInfo } from '../../model/s3.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class DocumentService extends BaseService {
    constructor(appService: AppService, private sourceDocumentRepository: SourceDocumentRepository, private s3Service: S3Service) {
        super(appService);
    }

    // the S3 folder is keyed by docType rather than a synthetic per-document id: propertyId+period+docType
    // already uniquely scopes one version lineage (no repository method here ever filters by anything else),
    // so this stays stable across every re-upload without needing to track/propagate a separate "document id"
    async getUploadUrl(propertyId: uniqueid, period: string, docType: DocType, originalFilename: string, contentType: string): Promise<ApiResponse<S3UploadInfo>> {
        const existing = await this.sourceDocumentRepository.getLatestByPropertyPeriodType(propertyId, period, docType);
        const version = (existing?.version || 0) + 1;
        const ext = originalFilename.split('.').pop();
        const directory = `${propertyId}/${period}/${docType}`;

        const uploadInfo = await this.s3Service.getUploadInfoForKey(Config.S3_BUCKET.CONTEXT, directory, `v${version}.${ext}`, contentType, false);
        return new ApiResponse(true, uploadInfo);
    }

    async register(propertyId: uniqueid, period: string, docType: DocType, s3Key: string, originalFilename: string, contentType: string, userId: authid): Promise<ApiResponse<SourceDocument>> {
        const existing = await this.sourceDocumentRepository.getLatestByPropertyPeriodType(propertyId, period, docType);

        const doc = new SourceDocument();
        doc.oid = UniqueId(Common.uniqueId()); // every version, including the first, is its own row - never an overwrite
        doc.propertyId = propertyId;
        doc.period = period;
        doc.docType = docType;
        doc.s3Key = s3Key;
        doc.version = (existing?.version || 0) + 1;
        doc.originalFilename = originalFilename;
        doc.contentType = contentType;
        doc.uploadedBy = userId;
        doc.uploadedAt = Date.now();
        doc.supersedes = existing?.oid;

        await this.sourceDocumentRepository.save(doc);
        return new ApiResponse(true, doc);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<SourceDocument[]> {
        return this.sourceDocumentRepository.getByPropertyPeriod(propertyId, period);
    }

    getVersionHistory(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument[]> {
        return this.sourceDocumentRepository.getVersionHistory(propertyId, period, docType);
    }

    async getDownloadUrl(docId: uniqueid): Promise<ApiResponse<string>> {
        const doc = await this.sourceDocumentRepository.getById(docId);
        if (!doc) {
            return new ApiErrorResponse('document not found');
        }

        const lastSlash = doc.s3Key.lastIndexOf('/');
        const directory = doc.s3Key.substring(0, lastSlash);
        const filename = doc.s3Key.substring(lastSlash + 1);

        return this.s3Service.getDisplayUrl(Config.S3_BUCKET.CONTEXT, directory, filename, doc.originalFilename);
    }
}
