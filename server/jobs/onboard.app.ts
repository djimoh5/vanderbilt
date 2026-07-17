import { BaseConfig } from '../config/config.base';
BaseConfig.FORCE_ENABLE_CONSOLE_LOG = true;

import { JobRunner, JobRunnerContext } from "./job.runner";
import { AppOnboardJob } from "./onboard.job";

new JobRunner(JobRunnerContext.Script, [[AppOnboardJob]]);

//ts-node jobs/onboard.app.ts --domain domain.com --bucket domain.release --release