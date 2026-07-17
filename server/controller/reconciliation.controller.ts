import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { ReconciliationService } from '../service/reconciliation.service';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ReconciliationController extends BaseController {
    constructor(private reconciliationService: ReconciliationService) {
        super();
    }

    async init(_req: Request) { }

    @Post(':id/run')
    async run(req: Request, res: Response) {
        const { tbAccountNumber } = req.body;
        const data = await this.reconciliationService.reconcile(UniqueId(req.params.id), AuthId(req.session.user.oid), tbAccountNumber);
        res.send(data);
    }

    @Get(':id')
    async getByExtractedData(req: Request, res: Response) {
        const data = await this.reconciliationService.getByExtractedData(UniqueId(req.params.id));
        this.sendSuccess(res, data);
    }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so the param name
    // must be referenced as req.params.propertyid (all-lowercase), not req.params.propertyId
    @Get(':propertyid/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.reconciliationService.getByPropertyPeriod(UniqueId(req.params.propertyid), req.params.period);
        this.sendSuccess(res, data);
    }
}
