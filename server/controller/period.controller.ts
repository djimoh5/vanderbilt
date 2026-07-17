import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { PeriodService } from '../service/period.service';
import { PeriodStatus } from '../../model/period.model';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PeriodController extends BaseController {
    constructor(private periodService: PeriodService) {
        super();
    }

    async init(_req: Request) { }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so the param name
    // must be referenced as req.params.propertyid (all-lowercase), not req.params.propertyId
    @Get(':propertyid/:period')
    async getStatusSummary(req: Request, res: Response) {
        const data = await this.periodService.getStatusSummary(UniqueId(req.params.propertyid), req.params.period);
        res.send(data);
    }

    @Post(':propertyid/:period/transition')
    async transition(req: Request, res: Response) {
        const { status } = req.body;
        if (!Object.values(PeriodStatus).includes(status)) {
            return this.sendError(res, 'invalid status');
        }
        const data = await this.periodService.transition(UniqueId(req.params.propertyid), req.params.period, status, AuthId(req.session.user.oid));
        res.send(data);
    }
}
