import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service'

import { S3UploadInfo } from '../../../../model/s3.model';
import { SourceDocument } from '../../../../model/source-document.model';

@Injectable()
export class DocumentService extends BaseService {
    constructor(apiService: ApiService, appService: AppService, private http: HttpClient) {
        super(apiService, appService, '');
    }

    uploadFile(url: string, file: File) {
        return this.http.put(url, file).toPromise();
    }

    getUploadInfo(file: File, isPublic?: boolean): Promise<S3UploadInfo> {
        return this.get('upload/info', { filename: file.name, fileType: file.type, isPublic: isPublic }).then((res: ApiResponse<S3UploadInfo>) => {
            return res.data;
        });
    }

    async upload(propertyId: string, period: string, docType: string, file: File): Promise<ApiResponse<SourceDocument>> {
        const urlRes: ApiResponse<S3UploadInfo> = await this.post('document/upload-url', {
            propertyId, period, docType, filename: file.name, contentType: file.type
        });
        if (!urlRes.success) {
            return urlRes as any;
        }

        await this.uploadFile(urlRes.data.signedRequest, file);

        return this.post('document', {
            propertyId, period, docType,
            s3Key: this.extractKey(urlRes.data.url), originalFilename: file.name, contentType: file.type
        });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<SourceDocument[]>> {
        return this.get(`document/${propertyId}/${period}`);
    }

    getVersionHistory(propertyId: string, period: string, docType: string): Promise<ApiResponse<SourceDocument[]>> {
        return this.get(`document/${propertyId}/${period}/${docType}/versions`);
    }

    getDownloadUrl(docId: string): Promise<ApiResponse<string>> {
        return this.get(`document/${docId}/download`);
    }

    private extractKey(url: string): string {
        return url.split('.amazonaws.com/')[1];
    }
}