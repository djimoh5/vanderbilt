import { Bootstrap, Injectable } from '../config/bootstrap';
import { ChartOfAccountRepository } from '../repository/chart-of-account.repository';
import { AccountActivationRepository } from '../repository/account-activation.repository';

import { ApiResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { ChartOfAccount, AccountActivation } from '../../model/chart-of-account.model';
import { UniqueId, uniqueid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class ChartOfAccountService extends BaseService {
    constructor(appService: AppService, private chartOfAccountRepository: ChartOfAccountRepository, private accountActivationRepository: AccountActivationRepository) {
        super(appService);
    }

    // runs inside the anonymous signup scope, so each seeded row is explicitly tagged
    // with the new tenant via the same _tid escape hatch signup uses for the UserAuth itself
    async seedTemplate(tenantId: uniqueid): Promise<void> {
        const template = await this.chartOfAccountRepository.getTemplate();
        for (const templateAccount of template) {
            const account: any = { ...templateAccount, oid: UniqueId(Common.uniqueId()), isTemplate: false };
            delete account.id;
            delete account._id;
            delete account._ts;
            delete account._tsu;
            delete account._u;
            delete account._uu;
            account._tid = tenantId;
            await this.chartOfAccountRepository.save(account);
        }
    }

    getByTenant(): Promise<ChartOfAccount[]> {
        return this.chartOfAccountRepository.getByTenant();
    }

    async activate(propertyId: uniqueid, accountId: uniqueid, active: boolean): Promise<ApiResponse<AccountActivation>> {
        let activation = await this.accountActivationRepository.getByPropertyAndAccount(propertyId, accountId);

        if (!activation) {
            activation = new AccountActivation();
            activation.oid = UniqueId(Common.uniqueId());
            activation.propertyId = propertyId;
            activation.accountId = accountId;
        }

        activation.active = active;

        await this.accountActivationRepository.save(activation);
        return new ApiResponse(true, activation);
    }

    getActivations(propertyId: uniqueid): Promise<AccountActivation[]> {
        return this.accountActivationRepository.getByProperty(propertyId);
    }
}
