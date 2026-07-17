import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { ChartOfAccount } from '../../model/chart-of-account.model';

@Injectable()
@Bootstrap()
export class ChartOfAccountRepository extends BaseRepository {
    constructor() {
        super('chart_of_account', { searchGlobalObjects: true });
    }

    getTemplate(): Promise<ChartOfAccount[]> {
        return this.context.find({ isTemplate: true });
    }

    getByTenant(): Promise<ChartOfAccount[]> {
        return this.context.find({ isTemplate: false });
    }

    save(account: ChartOfAccount): Promise<ChartOfAccount> {
        return super.updateObject(account);
    }
}
