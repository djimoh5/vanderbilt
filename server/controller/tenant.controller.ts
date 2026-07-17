import { BaseController, Get, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { TenantService } from '../service/tenant.service';
import { UniqueId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class TenantController extends BaseController {
    constructor(private tenantService: TenantService) {
        super();
    }

    async init(_req: Request) { }

    @Get('')
    async getCurrent(req: Request, res: Response) {
        const data = await this.tenantService.getCurrent(UniqueId(req.session.tenantId));
        res.send(data);
    }
}
