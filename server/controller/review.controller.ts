import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { ReviewService } from '../service/review.service';
import { UniqueId, AuthId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ReviewController extends BaseController {
    constructor(private reviewService: ReviewService) {
        super();
    }

    async init(_req: Request) { }

    // registered ahead of the bare :id route below - Express matches params against any string,
    // so 'inbox' as a literal segment must come first or it would be swallowed by :id
    @Get('inbox')
    async getInbox(req: Request, res: Response) {
        const data = await this.reviewService.getInbox(AuthId(req.session.user.oid));
        res.send(data);
    }

    @Get(':id')
    async getDetail(req: Request, res: Response) {
        const data = await this.reviewService.getDetail(UniqueId(req.params.id));
        res.send(data);
    }

    @Post(':id/comment')
    async addComment(req: Request, res: Response) {
        const { text } = req.body;
        if (!text) {
            return this.sendError(res, 'text is required');
        }
        const data = await this.reviewService.addComment(UniqueId(req.params.id), AuthId(req.session.user.oid), text);
        res.send(data);
    }

    // self-assign only ("Assign to me") - no teammate picker/user-list endpoint exists yet to support
    // assigning to someone else, so this keeps the assignment surface area to what's actually usable today
    @Post(':id/assign')
    async assign(req: Request, res: Response) {
        const data = await this.reviewService.assign(UniqueId(req.params.id), AuthId(req.session.user.oid));
        res.send(data);
    }

    @Post(':id/resolve')
    async resolve(req: Request, res: Response) {
        const { decision } = req.body;
        if (!['approved', 'rejected'].includes(decision)) {
            return this.sendError(res, 'decision must be approved or rejected');
        }
        const data = await this.reviewService.resolve(UniqueId(req.params.id), AuthId(req.session.user.oid), decision);
        res.send(data);
    }
}
