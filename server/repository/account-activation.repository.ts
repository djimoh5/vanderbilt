import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { AccountActivation } from '../../model/chart-of-account.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class AccountActivationRepository extends BaseRepository {
    constructor() {
        super('account_activation');
    }

    getByProperty(propertyId: uniqueid): Promise<AccountActivation[]> {
        return this.context.find({ propertyId });
    }

    getByPropertyAndAccount(propertyId: uniqueid, accountId: uniqueid): Promise<AccountActivation> {
        return this.context.findOne({ propertyId, accountId });
    }

    save(activation: AccountActivation): Promise<AccountActivation> {
        return super.updateObject(activation);
    }
}
