import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service'

import { S3UploadInfo } from '../../../../model/s3.model';

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
}