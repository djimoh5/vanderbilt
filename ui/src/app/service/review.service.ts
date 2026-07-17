import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { ReviewItem, ReviewInboxEntry, ReviewItemDetail } from 'bundle/model';

@Injectable()
export class ReviewService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getInbox(): Promise<ApiResponse<ReviewInboxEntry[]>> {
        return this.get('review/inbox');
    }

    getDetail(id: string): Promise<ApiResponse<ReviewItemDetail>> {
        return this.get(`review/${id}`);
    }

    addComment(id: string, text: string): Promise<ApiResponse<ReviewItem>> {
        return this.post(`review/${id}/comment`, { text });
    }

    resolve(id: string, decision: 'approved' | 'rejected'): Promise<ApiResponse<ReviewItem>> {
        return this.post(`review/${id}/resolve`, { decision });
    }
}
