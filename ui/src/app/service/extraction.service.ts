import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { ExtractedData } from 'bundle/model';

@Injectable()
export class ExtractionService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    run(sourceDocumentId: string): Promise<ApiResponse<{ extractedDataId: string }>> {
        return this.post(`extraction/${sourceDocumentId}/run`, {});
    }

    getResult(sourceDocumentId: string): Promise<ApiResponse<ExtractedData>> {
        return this.get(`extraction/${sourceDocumentId}`);
    }
}
