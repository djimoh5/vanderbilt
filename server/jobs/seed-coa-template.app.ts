import { BaseConfig } from '../config/config.base';
BaseConfig.FORCE_ENABLE_CONSOLE_LOG = true;

import { JobRunner, JobRunnerContext } from "./job.runner";
import { SeedCoaTemplateJob } from "./seed-coa-template.job";

new JobRunner(JobRunnerContext.Script, [[SeedCoaTemplateJob]]);

//ts-node jobs/seed-coa-template.app.ts
