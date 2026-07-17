import { Bootstrap, Injectable } from "../config/bootstrap";
import { BaseRepository } from "./base.repository";
import { ErrorType, Exception } from "../../model/error.model";
import { PaginationModel } from "../../model/shared.model";
import { DatabaseConnection } from "../database/database";
import { authid } from "../../model/id.model";
import { SortOrder } from "../database/operations";

@Injectable()
@Bootstrap()
export class ErrorLogRepository extends BaseRepository {
    constructor() {
        super('error_log', { connection: DatabaseConnection.LOG });
    }

    add(exp: Error, type: ErrorType, authId: authid, data?: any) {
        this.context.insert({ e: (exp.stack || exp), t: type, d: data }, authId);
    }

    getErrors(page: number, pageSize: number): Promise<PaginationModel<Exception>> {
        return this.context.page({}, page, pageSize, null, d => {
            return {
                id: d._id.toString(),
                exception: d.e,
                date: d._ts,
                type: d.t
            };
        });
    }

    getRecent(limit: number): Promise<Exception[]> {
        return this.context.find({}, null, { sort: { _ts: SortOrder.Descending }, limit: limit }, d => {
            return {
                id: d._id.toString(),
                exception: d.e,
                date: d._ts,
                type: d.t
            };
        });
    }

    //Error Handler
    waitForConnection() {
        return this.context.onConnect();
    }
}