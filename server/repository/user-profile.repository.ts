import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { UserProfile } from '../../model/user.model';
import { authid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class UserProfileRepository extends BaseRepository {
    constructor() {
        super('user_profile');
    }

    getByAuthOid(authOid: authid): Promise<UserProfile> {
        return this.context.findOne({ authOid });
    }

    getByAuthOids(authOids: authid[]): Promise<UserProfile[]> {
        return this.context.find({ authOid: { $in: authOids } });
    }

    save(profile: UserProfile): Promise<UserProfile> {
        return this.context.update({ authOid: profile.authOid }, profile, null, { upsert: true });
    }
}
