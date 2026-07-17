import { Bootstrap, Injectable } from "../../config/bootstrap";
import { BaseRepository } from "../base.repository";
import { DatabaseConnection } from "../../database/database";
import { AILog } from "../../../model/log.model";
import { SortOrder } from "../../database/operations";

@Injectable()
@Bootstrap()
export class AILogRepository extends BaseRepository {
    constructor() {
        super('ai_log', { connection: DatabaseConnection.LOG });
    }

    log(log: AILog, authId: string): Promise<AILog> {
        return this.context.insert(log, authId);
    }

    getRecent(limit: number): Promise<AILog[]> {
        return this.context.find({}, null, { sort: { _ts: SortOrder.Descending }, limit: limit });
    }
}