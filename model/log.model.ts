import { authid } from "./id.model";
import { GenericMap } from "./shared.model";

export interface AILog {
    request: any;
    response: any;
}

export interface AuthLog {
    provider: string;
    status: AuthStatus;
    agentAuthId?: authid;
    username?: string;
    message?: string;
    metadata?: GenericMap<any>;
}

export enum AuthStatus {
    Success = 1,
    Fail = 2
}