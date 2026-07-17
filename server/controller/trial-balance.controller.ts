import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { TrialBalanceService } from '../service/trial-balance.service';
import { S3Service } from '../service/s3.service';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class TrialBalanceController extends BaseController {
    constructor(private trialBalanceService: TrialBalanceService, private s3Service: S3Service) {
        super();
    }

    async init(_req: Request) { }

    @Post('import')
    async import(req: Request, res: Response) {
        const { propertyId, period, url } = req.body;
        if (!propertyId || !period || !url) {
            return this.sendError(res, 'propertyId, period, and url are required');
        }

        const raw = await this.s3Service.getRawObjectByUrl(url);
        if (!raw.success) {
            return this.sendError(res, 'could not read uploaded file');
        }

        const data = await this.trialBalanceService.importFromWorkbook(raw.data.content as Buffer, UniqueId(propertyId), period, AuthId(req.session.user.oid));
        res.send(data);
    }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so the param name
    // must be referenced as req.params.propertyid (all-lowercase), not req.params.propertyId
    @Get(':propertyid/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.trialBalanceService.getByPropertyPeriod(UniqueId(req.params.propertyid), req.params.period);
        this.sendSuccess(res, data);
    }
}
