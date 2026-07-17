import { Bootstrap, Injectable } from '../config/bootstrap';
import { TrialBalanceRepository } from '../repository/trial-balance.repository';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { TrialBalanceAccountLine, TrialBalanceSnapshot } from '../../model/trial-balance.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';
import { xlsx } from '../lib/xlsx/xlsx.utility';

@Injectable()
@Bootstrap()
export class TrialBalanceService extends BaseService {
    constructor(appService: AppService, private trialBalanceRepository: TrialBalanceRepository) {
        super(appService);
    }

    async importFromWorkbook(buffer: Buffer, propertyId: uniqueid, period: string, userId: authid): Promise<ApiResponse<TrialBalanceSnapshot>> {
        const rows = xlsx.fileToRows(buffer, true);

        // Yardi's TB export leads with a few title/metadata rows and a two-row column header before
        // the account rows start; account rows are the only ones with both an account number and a
        // numeric "balance forward" value in column index 2, which also excludes the trailing Total row.
        const accounts: TrialBalanceAccountLine[] = rows
            .filter(row => row[0] && typeof row[2] === 'number')
            .map(row => ({
                accountNumber: String(row[0]).trim(),
                accountName: String(row[1] || '').trim(),
                balance: Number(row[5]) || 0
            }));

        if (accounts.length === 0) {
            return new ApiErrorResponse('no account rows found in workbook — check the export matches the expected Yardi Trial Balance layout');
        }

        const snapshot = new TrialBalanceSnapshot();
        snapshot.oid = UniqueId(Common.uniqueId());
        snapshot.propertyId = propertyId;
        snapshot.period = period;
        snapshot.accounts = accounts;
        snapshot.importedAt = Date.now();
        snapshot.importedBy = userId;

        await this.trialBalanceRepository.save(snapshot);
        return new ApiResponse(true, snapshot);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<TrialBalanceSnapshot> {
        return this.trialBalanceRepository.getByPropertyPeriod(propertyId, period);
    }
}
