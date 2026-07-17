import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { Invite } from '../../model/invite.model';

@Injectable()
@Bootstrap()
export class InviteRepository extends BaseRepository {
    constructor() {
        super('invite');
    }

    getByCode(code: string): Promise<Invite> {
        return this.context.findOne({ inviteCode: code });
    }

    getByUsername(username: string): Promise<Invite> {
        return this.context.findOne({ username: username });
    }

    save(invite: Invite): Promise<Invite> {
        return super.updateObject(invite);
    }
}
