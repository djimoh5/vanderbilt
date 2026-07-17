import { Common } from "../utility/common";
import { uniqueid } from "./id.model";

export class Invite {
    oid: uniqueid;

    constructor(
        public username: string,
        public inviteCode: string,
        public inviteExpiry: number,
        public invitedBy: string
    ) {
        this.oid = Common.uniqueId();
    }
}
