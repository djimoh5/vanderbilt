import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { PropertyService } from '../service/property.service';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class PropertyController extends BaseController {
    constructor(private propertyService: PropertyService) {
        super();
    }

    async init(_req: Request) { }

    @Post('')
    async create(req: Request, res: Response) {
        const { name, yardiCode } = req.body;
        if (!name) return this.sendError(res, 'name is required');
        const data = await this.propertyService.create(name, yardiCode);
        res.send(data);
    }

    @Get('')
    async getAll(_req: Request, res: Response) {
        const data = await this.propertyService.getAll();
        this.sendSuccess(res, data);
    }

    @Post(':id/role')
    async assignRole(req: Request, res: Response) {
        const { userId, role } = req.body;
        if (!userId || !role) return this.sendError(res, 'userId and role are required');
        const data = await this.propertyService.assignRole(UniqueId(req.params.id), AuthId(userId), role);
        res.send(data);
    }
}
