import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { ChecklistService } from '../service/checklist.service';
import { ChecklistItemStatus } from '../../model/checklist-instance.model';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ChecklistController extends BaseController {
    constructor(private checklistService: ChecklistService) {
        super();
    }

    async init(_req: Request) { }

    @Get('templates')
    async getTemplates(_req: Request, res: Response) {
        const data = await this.checklistService.getTemplates();
        this.sendSuccess(res, data);
    }

    @Post('instantiate')
    async instantiate(req: Request, res: Response) {
        const { propertyId, period } = req.body;
        if (!propertyId || !period) {
            return this.sendError(res, 'propertyId and period are required');
        }
        const data = await this.checklistService.instantiateForPeriod(UniqueId(propertyId), period);
        res.send(data);
    }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so param names must be
    // referenced as req.params.propertyid (all-lowercase), not req.params.propertyId. 'templates'
    // and 'instantiate' are registered ahead of the bare :propertyid/:period route below for the
    // same reason document.controller.ts/trial-balance.controller.ts already call out.
    @Get(':propertyid/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.checklistService.getByPropertyPeriod(UniqueId(req.params.propertyid), req.params.period);
        res.send(data);
    }

    @Post(':propertyid/:period/item/:key')
    async updateItemStatus(req: Request, res: Response) {
        const { status } = req.body;
        if (!Object.values(ChecklistItemStatus).includes(status)) {
            return this.sendError(res, 'status must be one of yes, no, na, unanswered');
        }
        const data = await this.checklistService.updateItemStatus(UniqueId(req.params.propertyid), req.params.period, req.params.key, status, AuthId(req.session.user.oid));
        res.send(data);
    }

    @Post(':propertyid/:period/item/:key/comment')
    async addComment(req: Request, res: Response) {
        const { text } = req.body;
        if (!text) {
            return this.sendError(res, 'text is required');
        }
        const data = await this.checklistService.addComment(UniqueId(req.params.propertyid), req.params.period, req.params.key, AuthId(req.session.user.oid), text);
        res.send(data);
    }

    // self-assign only ("Assign to me") - no teammate picker/user-list endpoint exists yet to support
    // assigning to someone else, so this keeps the assignment surface area to what's actually usable today
    @Post(':propertyid/:period/item/:key/assign')
    async assignItem(req: Request, res: Response) {
        const data = await this.checklistService.assignItem(UniqueId(req.params.propertyid), req.params.period, req.params.key, AuthId(req.session.user.oid));
        res.send(data);
    }
}
