import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { DocumentService } from '../service/document.service';
import { UniqueId, AuthId } from '../../model/id.model';
import { DocType } from '../../model/source-document.model';

@Injectable()
@Bootstrap()
export class DocumentController extends BaseController {
    constructor(private documentService: DocumentService) {
        super();
    }

    async init(_req: Request) { }

    @Post('upload-url')
    async getUploadUrl(req: Request, res: Response) {
        const { propertyId, period, docType, filename, contentType } = req.body;
        if (!propertyId || !period || !docType || !filename) {
            return this.sendError(res, 'propertyId, period, docType, and filename are required');
        }
        const data = await this.documentService.getUploadUrl(UniqueId(propertyId), period, docType, filename, contentType);
        res.send(data);
    }

    @Post('')
    async register(req: Request, res: Response) {
        const { propertyId, period, docType, s3Key, originalFilename, contentType } = req.body;
        if (!propertyId || !period || !docType || !s3Key || !originalFilename) {
            return this.sendError(res, 'propertyId, period, docType, s3Key, and originalFilename are required');
        }
        const data = await this.documentService.register(UniqueId(propertyId), period, docType, s3Key, originalFilename, contentType, AuthId(req.session.user.oid));
        res.send(data);
    }

    // NOTE: route paths are lowercased by BaseController.getRoutePath, so param names must be
    // referenced as req.params.propertyid/doctype (all-lowercase), not req.params.propertyId/docType.
    // download/versions are also registered ahead of the bare :propertyid/:period route below -
    // Express matches params against any string, so a more specific literal segment must come first
    // or a request like GET /document/{id}/download would instead be swallowed by :propertyid/:period.
    @Get(':id/download')
    async download(req: Request, res: Response) {
        const data = await this.documentService.getDownloadUrl(UniqueId(req.params.id));
        res.send(data);
    }

    @Get(':propertyid/:period/:doctype/versions')
    async getVersions(req: Request, res: Response) {
        const data = await this.documentService.getVersionHistory(UniqueId(req.params.propertyid), req.params.period, req.params.doctype as DocType);
        this.sendSuccess(res, data);
    }

    @Get(':propertyid/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.documentService.getByPropertyPeriod(UniqueId(req.params.propertyid), req.params.period);
        this.sendSuccess(res, data);
    }
}
