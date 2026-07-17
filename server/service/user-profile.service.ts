import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseService, ApiResponse } from './base.service';
import { AppService } from './app.service';
import { UserProfileRepository } from '../repository/user-profile.repository';
import { UserProfile } from '../../model/user.model';
import { authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class UserProfileService extends BaseService {
    constructor(
        protected appService: AppService,
        protected userProfileRepository: UserProfileRepository
    ) {
        super(appService);
    }

    async getProfile(authOid: authid): Promise<ApiResponse<UserProfile>> {
        const profile = await this.userProfileRepository.getByAuthOid(authOid);
        if (!profile) {
            return new ApiResponse(false, null, 'profile not found');
        }
        return new ApiResponse(true, profile);
    }

    async updateProfile(authOid: authid, firstName: string, lastName: string): Promise<ApiResponse<UserProfile>> {
        let profile = await this.userProfileRepository.getByAuthOid(authOid);
        if (!profile) {
            profile = new UserProfile();
            profile.oid = Common.uniqueId();
            profile.authOid = authOid;
        }
        profile.firstName = firstName;
        profile.lastName = lastName;
        const saved = await this.userProfileRepository.save(profile);
        return new ApiResponse(true, saved);
    }
}
