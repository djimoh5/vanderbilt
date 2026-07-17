require('../lib/globals.js');

import { Database, DatabaseConnection } from '../database/database';
import { Pipeline } from '../lib/pipeline';

import { Injector } from '../config/bootstrap';
import { DeployConfig } from '../config/deploy.config';

import { Job, JobRunnerContext } from '../../model/job.model';
export { JobRunnerContext } from '../../model/job.model';

//Node.JS process error handler
//import { ErrorHandler } from '../lib/error-handler';

import { SecretManager } from '../config/secret-manager';
//import { AuditUser } from '../model/audit.model';
import { Config } from '../config/config';
import { Common } from '../../utility/common';

export class JobRunner {
    pipelines: Pipeline[];
    processed: Job[] = [];
    failed: { runnable: Job, ex: { message: string, stack: string } }[] = [];
    
    restartDelay: number = 5000;

    constructor(context: JobRunnerContext, jobLists: { new(...args: any): Job }[][], private onDone?: (processed: Job[], failed: { runnable: Job, ex: { message: string, stack: string } }[]) => void, platformId?: number, private contextData?: any, runDate?: number) {
        if(Config.DATABASE_MAINTENANCE_MODE) {
            process.exit();
        }

        //ErrorHandler.setAppName('JobRunner');
        if(!platformId) {
            platformId = DeployConfig.INJECTED_TENANT_ID as any;
        }

        //ErrorHandler.setUser(AuditUser.getJobUser('JobRunner', context, platformId));
        
        SecretManager.init().then(() => {
            Database.openAll([DatabaseConnection.APP, DatabaseConnection.AUDIT, DatabaseConnection.LOG]).then(() => {
                this.pipelines = [];
                
                jobLists.forEach(list => {
                    const pipeline = new Pipeline(platformId);
                    pipeline.context.data = this.contextData;
                    pipeline.onComplete = (processed, failed) => {
                        this.processed = this.processed.concat(<Job[]>processed);
                        this.failed = this.failed.concat(<{ runnable: Job, ex: any }[]>failed);
                        this.run();
                    };

                    this.pipelines.push(pipeline);

                    list.forEach(job => {
                        const jobInstance = Injector.get(job);
                        //jobInstance.emailTriggerService = Injector.get(platformId, EmailTriggerService);
                        jobInstance.platformId = platformId;
                        jobInstance.runningContext = context;
                        jobInstance.runDate = runDate || Config.RUN_TIME;
                        pipeline.add(jobInstance);
                    });
                });

                this.run();
            });
        });
    }

    run() {
        const pipeline = this.pipelines.splice(0, 1)[0];
        if(pipeline) {
            console.log(`Executing Pipeline: Running ${pipeline.list.length} jobs`);
            pipeline.run();
        }
        else {
            if (!this.onDone && this.failed.length > 0){
                //const first = this.failed[0];
                
                //ErrorHandler.setUser(first.runnable.auditUserId);
                const error = new Error(`Job Runner Failed: ${this.failed.map(r => `${r.runnable.name} - ${r.ex && r.ex.message}`).join(', ')}`);
                const additionalEmails = [];

                for (let index = 0; index < this.failed.length; index++) {
                    const failure = this.failed[index];
                    if (failure.runnable.errorEmails && failure.runnable.errorEmails.length > 0) {
                        additionalEmails.push(...failure.runnable.errorEmails);
                    }

                    if (failure.ex && failure.ex.stack) {
                        error.stack += failure.ex.stack;
                    }
                }

                if (additionalEmails.length > 0) {
                    error['additionalEmails'] = Common.distinct(additionalEmails);
                }
                error['failures'] = this.failed.map(r => r.ex) as any;
                throw error;
            }
            else {
                setTimeout(() => {
                    this.onDone ? this.onDone(this.processed, this.failed) : process.exit();
                }, this.restartDelay);
            }
        }
    }
}