import { BaseConfig } from '../config/config.base';
BaseConfig.FORCE_ENABLE_CONSOLE_LOG = true;

import { JobRunner, JobRunnerContext } from "./job.runner";
import { StaleReviewJob } from "./stale-review.job";

new JobRunner(JobRunnerContext.Script, [[StaleReviewJob]]);

//ts-node jobs/stale-review.app.ts
