import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { TenantConfig } from '../../model/tenant-config.model';

@Injectable()
@Bootstrap()
export class TenantConfigRepository extends BaseRepository {
    constructor() {
        super('tenant_config');
    }

    // one document per tenant - no query filter needed beyond the automatic tenant scoping
    get(): Promise<TenantConfig> {
        return this.context.findOne({});
    }

    save(config: TenantConfig): Promise<TenantConfig> {
        return super.updateObject(config);
    }
}
