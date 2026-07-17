import { BaseConfig } from '../config/config.base';
BaseConfig.FORCE_ENABLE_CONSOLE_LOG = true;

import { JobRunner, JobRunnerContext } from "./job.runner";
import { SeedChecklistTemplateJob } from "./seed-checklist-template.job";

new JobRunner(JobRunnerContext.Script, [[SeedChecklistTemplateJob]]);

//ts-node jobs/seed-checklist-template.app.ts
