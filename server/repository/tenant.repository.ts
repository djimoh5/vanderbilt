import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { Tenant } from '../../model/tenant.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class TenantRepository extends BaseRepository {
    constructor() {
        super('tenant');
    }

    getByOid(oid: uniqueid): Promise<Tenant> {
        return this.context.findOne({ oid });
    }

    save(tenant: Tenant): Promise<Tenant> {
        return super.updateObject(tenant);
    }
}
