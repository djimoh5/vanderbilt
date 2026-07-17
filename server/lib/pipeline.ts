import { IRunnable } from '../../model/job.model';
import { ErrorService } from '../service/error.service';
import { Common } from '../../utility/common';
//import { ErrorHandler } from './error-handler';

export class Pipeline {
    context: { platformId?: number, data?: any } = {};
    list: IRunnable[] = [];
    processed: IRunnable[] = [];
    failed: { runnable: IRunnable, ex: { message: string, stack: string } }[] = [];
    onComplete: (processed: IRunnable[], failed: { runnable: IRunnable, ex: { message: string, stack: string } }[]) => void;

    constructor(platformId?: number){
        this.context.platformId = platformId;
    }
    
    get size(): number { return this.list.length; }

    add(runnable: IRunnable) {
        this.list.push(runnable);
        runnable.onNext = () => {
            //we completed from runnable.done(...) should be safe to keep going
            this.processed.push(runnable);
            this.next();
        };
    }

    run() {
        this.next();
    }

    async next() {        
        if(this.list.length > 0) {
            const runnable = this.list.splice(0, 1)[0];
            //ErrorHandler.setUser(runnable.auditUserId);

            console.log(runnable.name, 'started', runnable.runDate? `@ ${Common.formatDate(new Date(runnable.runDate), Common.DateFormat.longDateTime)}` : '');
            try {
                await runnable.run(this.context).then(() => {
                    console.log("runnable completed:", runnable.name);
                    //safe to do nothing since runnable.done(...) ran above
                }).catch(async (reason: Error) => {
                    const error = ErrorService.convertToObject(reason);

                    runnable['result'] = {
                        success: false,
                        data: error,
                        msg: error.message
                    };

                    this.list = [];
                    this.failed.push({ runnable: runnable, ex: error });
                    await this.next();
                });
            }
            catch(e) {
                const error = ErrorService.convertToObject(e);
                console.log('pipeline failed on:', runnable.name);
                runnable['result'] = {
                    success: false,
                    msg: error.message
                };
                this.list = [];
                this.failed.push({ runnable: runnable, ex: error });
                await this.next();
            }
        }
        else {
            //ErrorHandler.setUser(null);
            console.log('pipeline complete');
            if(this.onComplete) {
                console.log("On Complete:", 'success:', this.processed.length, 'failed:',  this.failed.length);
                this.onComplete(this.processed, this.failed);
            }
            else {
                setTimeout(() => process.exit(), 5000);
            }
        }
    }
}