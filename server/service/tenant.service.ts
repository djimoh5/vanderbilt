import { Bootstrap, Injectable } from '../config/bootstrap';
import { TenantRepository } from '../repository/tenant.repository';
import { ChartOfAccountService } from './chart-of-account.service';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { Tenant } from '../../model/tenant.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class TenantService extends BaseService {
    constructor(appService: AppService, private tenantRepository: TenantRepository, private chartOfAccountService: ChartOfAccountService) {
        super(appService);
    }

    // called from AuthService immediately after a brand-new UserAuth/tenantId is persisted
    async createForSignup(tenantId: uniqueid, name: string): Promise<Tenant> {
        const tenant = new Tenant();
        tenant.oid = tenantId; // the Tenant's own identity *is* the tenantId just minted for the signing-up user
        tenant.name = name;
        tenant.createdAt = Date.now();

        await this.tenantRepository.save(tenant);
        await this.chartOfAccountService.seedTemplate(tenantId);
        return tenant;
    }

    getCurrent(tenantId: uniqueid): Promise<ApiResponse<Tenant>> {
        return this.tenantRepository.getByOid(tenantId).then(t => t ? new ApiResponse(true, t) : new ApiErrorResponse('tenant not found'));
    }
}
