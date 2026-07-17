import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { ReconciliationService } from '../service/reconciliation.service';

@Injectable()
@Bootstrap()
export class TenantConfigController extends BaseController {
    constructor(private reconciliationService: ReconciliationService) {
        super();
    }

    async init(_req: Request) { }

    @Get('')
    async get(_req: Request, res: Response) {
        const data = await this.reconciliationService.getTenantConfig();
        this.sendSuccess(res, data);
    }

    @Post('')
    async update(req: Request, res: Response) {
        const { dollar, percent } = req.body;
        if (dollar == null || percent == null) {
            return this.sendError(res, 'dollar and percent are required');
        }
        const data = await this.reconciliationService.updateTenantConfig(dollar, percent);
        res.send(data);
    }
}
