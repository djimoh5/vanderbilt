import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { ChecklistTemplate, ChecklistInstance, ChecklistItemStatus } from 'bundle/model';

@Injectable()
export class ChecklistService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getTemplates(): Promise<ApiResponse<ChecklistTemplate[]>> {
        return this.get('checklist/templates');
    }

    instantiate(propertyId: string, period: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.post('checklist/instantiate', { propertyId, period });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.get(`checklist/${propertyId}/${period}`);
    }

    updateItemStatus(propertyId: string, period: string, itemKey: string, status: ChecklistItemStatus): Promise<ApiResponse<ChecklistInstance>> {
        return this.post(`checklist/${propertyId}/${period}/item/${itemKey}`, { status });
    }

    addComment(propertyId: string, period: string, itemKey: string, text: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.post(`checklist/${propertyId}/${period}/item/${itemKey}/comment`, { text });
    }
}
