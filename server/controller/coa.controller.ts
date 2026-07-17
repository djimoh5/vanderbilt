import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { ChartOfAccountService } from '../service/chart-of-account.service';
import { UniqueId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class CoaController extends BaseController {
    constructor(private chartOfAccountService: ChartOfAccountService) {
        super();
    }

    async init(_req: Request) { }

    @Get('')
    async getAll(_req: Request, res: Response) {
        const data = await this.chartOfAccountService.getByTenant();
        this.sendSuccess(res, data);
    }

    @Post('activation')
    async setActivation(req: Request, res: Response) {
        const { propertyId, accountId, active } = req.body;
        const data = await this.chartOfAccountService.activate(UniqueId(propertyId), UniqueId(accountId), active);
        res.send(data);
    }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so the param name
    // must be referenced as req.params.propertyid (all-lowercase), not req.params.propertyId
    @Get('activation/:propertyid')
    async getActivations(req: Request, res: Response) {
        const data = await this.chartOfAccountService.getActivations(UniqueId(req.params.propertyid));
        this.sendSuccess(res, data);
    }
}
