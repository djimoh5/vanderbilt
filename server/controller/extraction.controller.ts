import { BaseController, Get, Post, Request, Response } from './base.controller';
import { Bootstrap, Injectable, Injector } from '../config/bootstrap';

import { ExtractionService } from '../service/extraction.service';
import { ExtractionJob } from '../jobs/extraction.job';
import { Pipeline } from '../lib/pipeline';
import { UniqueId } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ExtractionController extends BaseController {
    constructor(private extractionService: ExtractionService) {
        super();
    }

    async init(_req: Request) { }

    @Post(':id/run')
    async run(req: Request, res: Response) {
        // explicit tenant-scoped resolution: ExtractionJob isn't a controller-constructor dependency here,
        // so it must be re-resolved through the current tenant's own DI scope rather than the default one
        const job = Injector.get(ExtractionJob, req.session.tenantId);
        job.setSourceDocument(UniqueId(req.params.id));

        // Job.done() calls this.onNext(), which only exists once a Pipeline has wired it up - running
        // the job bare would throw. A single-job Pipeline gives us that wiring without the script-oriented
        // bootstrapping (SecretManager.init/Database.openAll/process.exit) that JobRunner does for CLI jobs.
        await new Promise<void>(resolve => {
            const pipeline = new Pipeline();
            pipeline.onComplete = () => resolve();
            pipeline.add(job);
            pipeline.run();
        });

        res.send(job.result);
    }

    @Get(':id')
    async getResult(req: Request, res: Response) {
        const data = await this.extractionService.getBySourceDocument(UniqueId(req.params.id));
        this.sendSuccess(res, data);
    }
}
