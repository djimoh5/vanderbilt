import { Bootstrap, Injectable } from '../config/bootstrap';
import { ChecklistTemplateRepository } from '../repository/checklist-template.repository';
import { ChecklistInstanceRepository } from '../repository/checklist-instance.repository';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { ChecklistTemplate } from '../../model/checklist-template.model';
import { ChecklistInstance, ChecklistItemResponse, ChecklistItemStatus } from '../../model/checklist-instance.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class ChecklistService extends BaseService {
    constructor(
        appService: AppService,
        private checklistTemplateRepository: ChecklistTemplateRepository,
        private checklistInstanceRepository: ChecklistInstanceRepository
    ) {
        super(appService);
    }

    getTemplates(): Promise<ChecklistTemplate[]> {
        return this.checklistTemplateRepository.getAll();
    }

    async instantiateForPeriod(propertyId: uniqueid, period: string): Promise<ApiResponse<ChecklistInstance>> {
        const existing = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        if (existing) {
            return new ApiResponse(true, existing);
        }

        const templates = await this.checklistTemplateRepository.getAll();
        if (templates.length === 0) {
            return new ApiErrorResponse('no checklist template configured yet');
        }

        const responses: ChecklistItemResponse[] = templates.flatMap(t =>
            t.items.map(item => ({ itemKey: item.key, status: ChecklistItemStatus.Unanswered, comments: [] }))
        );

        const instance = new ChecklistInstance();
        instance.oid = UniqueId(Common.uniqueId());
        instance.propertyId = propertyId;
        instance.period = period;
        instance.templateIds = templates.map(t => t.oid);
        instance.responses = responses;
        instance.createdAt = Date.now();

        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }

    async getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ApiResponse<ChecklistInstance>> {
        const instance = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        return new ApiResponse(true, instance || null);
    }

    async updateItemStatus(propertyId: uniqueid, period: string, itemKey: string, status: ChecklistItemStatus, _userId: authid): Promise<ApiResponse<ChecklistInstance>> {
        const instance = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        if (!instance) {
            return new ApiErrorResponse('checklist has not been started for this property/period yet');
        }

        const response = instance.responses.find(r => r.itemKey === itemKey);
        if (!response) {
            return new ApiErrorResponse('unknown checklist item');
        }

        response.status = status;
        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }

    async addComment(propertyId: uniqueid, period: string, itemKey: string, userId: authid, text: string): Promise<ApiResponse<ChecklistInstance>> {
        const instance = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        if (!instance) {
            return new ApiErrorResponse('checklist has not been started for this property/period yet');
        }

        const response = instance.responses.find(r => r.itemKey === itemKey);
        if (!response) {
            return new ApiErrorResponse('unknown checklist item');
        }

        response.comments.push({ authorId: userId, text, createdAt: Date.now() });
        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }
}
