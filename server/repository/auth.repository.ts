import { Bootstrap, Injectable } from "../config/bootstrap";
import { BaseRepository } from "./base.repository";
import { UserAuth } from "../../model/auth.model";

@Injectable()
@Bootstrap()
export class AuthRepository extends BaseRepository {
    constructor() {
        super('agent_auth', { searchGlobalObjects: true });
    }

    // username lookups must be resolvable before a request has any tenant context at all
    // (that's how login/signup discover which tenant a user belongs to in the first place),
    // so these bypass tenant scoping entirely rather than relying on searchGlobalObjects
    // (which only ever matches the caller's own ambient tenant plus null-tenant rows).
    getByUsername(username: string): Promise<UserAuth> {
        username = username.toLowerCase();
        return this.context.findOne({ username: username }, { password: 0 }, true);
    }

    getByUsernameWithCredentials(username: string): Promise<UserAuth> {
        username = username.toLowerCase();
        return this.context.findOne({ username: username }, null, true);
    }

    update(auth: UserAuth): Promise<UserAuth> {
        console.log(`updating auth ${auth.oid}`);
        auth.username = auth.username.toLowerCase();
        return super.updateObject(auth);
    }

    getAll(): Promise<UserAuth[]> {
        return this.context.find({}, { password: 0 });
    }

    getByOids(oids: string[]): Promise<UserAuth[]> {
        return this.context.find({ oid: { $in: oids } }, { password: 0 });
    }

    getByUsernames(usernames: string[]): Promise<UserAuth[]> {
        return this.context.find({ username: { $in: usernames } }, { password: 0 });
    }

    removeVirtualFlag(oid: string): Promise<any> {
        return this.context.update({ oid }, { virtual: '' }, null, { unset: true });
    }
}