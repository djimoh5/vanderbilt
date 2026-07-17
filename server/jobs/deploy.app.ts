import { BaseConfig } from '../config/config.base';
BaseConfig.FORCE_ENABLE_CONSOLE_LOG = true;

import { JobRunner, JobRunnerContext } from "./job.runner";

import { UIDeployJob } from "./ui.deploy.job";

new JobRunner(JobRunnerContext.Script, [
    [UIDeployJob]
]);