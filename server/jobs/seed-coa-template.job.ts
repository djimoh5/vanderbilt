import { Bootstrap, Injectable } from '../config/bootstrap';

import { Job } from '../../model/job.model';
import { ChartOfAccount, StatementType, AccountSourceType } from '../../model/chart-of-account.model';
import { UniqueId } from '../../model/id.model';
import { Common } from '../../utility/common';

import { ChartOfAccountRepository } from '../repository/chart-of-account.repository';

// Placeholder starter template — NOT the full ~666-row Vanderbilt portfolio-wide COA.
// Replace/extend this list with the real dataset before relying on this job for production seeding.
const TEMPLATE_ACCOUNTS: { accountNumber: string, name: string, statementType: StatementType, category: string, subCategory?: string }[] = [
    { accountNumber: '1000', name: 'Operating Cash', statementType: StatementType.BalanceSheet, category: 'Cash' },
    { accountNumber: '1010', name: 'Security Deposit Cash', statementType: StatementType.BalanceSheet, category: 'Cash' },
    { accountNumber: '1100', name: 'Accounts Receivable - Tenants', statementType: StatementType.BalanceSheet, category: 'AR' },
    { accountNumber: '1200', name: 'Prepaid Insurance', statementType: StatementType.BalanceSheet, category: 'Prepaid Expenses' },
    { accountNumber: '1500', name: 'Land', statementType: StatementType.BalanceSheet, category: 'Fixed Assets' },
    { accountNumber: '1510', name: 'Building', statementType: StatementType.BalanceSheet, category: 'Fixed Assets' },
    { accountNumber: '1520', name: 'Accumulated Depreciation - Building', statementType: StatementType.BalanceSheet, category: 'Fixed Assets' },
    { accountNumber: '2000', name: 'Accounts Payable', statementType: StatementType.BalanceSheet, category: 'AP' },
    { accountNumber: '2100', name: 'Tenant Security Deposits Held', statementType: StatementType.BalanceSheet, category: 'Liabilities' },
    { accountNumber: '2200', name: 'Mortgage Payable', statementType: StatementType.BalanceSheet, category: 'Liabilities' },
    { accountNumber: '3000', name: "Owner's Equity", statementType: StatementType.BalanceSheet, category: 'Equity' },
    { accountNumber: '4000', name: 'Rental Income', statementType: StatementType.IncomeStatement, category: 'Revenue' },
    { accountNumber: '4100', name: 'Parking Income', statementType: StatementType.IncomeStatement, category: 'Revenue' },
    { accountNumber: '4200', name: 'Late Fee Income', statementType: StatementType.IncomeStatement, category: 'Revenue' },
    { accountNumber: '4900', name: 'Other Income', statementType: StatementType.IncomeStatement, category: 'Revenue' },
    { accountNumber: '5000', name: 'Repairs & Maintenance', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5100', name: 'Utilities', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5200', name: 'Property Insurance', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5300', name: 'Property Taxes', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5400', name: 'Management Fees', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5500', name: 'Payroll & Benefits', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5600', name: 'Landscaping & Grounds', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '5900', name: 'General & Administrative', statementType: StatementType.IncomeStatement, category: 'Operating Expenses' },
    { accountNumber: '6000', name: 'Mortgage Interest Expense', statementType: StatementType.IncomeStatement, category: 'Non-Operating Expenses' },
    { accountNumber: '6100', name: 'Depreciation Expense', statementType: StatementType.IncomeStatement, category: 'Non-Operating Expenses' },
];

@Injectable()
@Bootstrap()
export class SeedCoaTemplateJob extends Job {
    constructor(private chartOfAccountRepository: ChartOfAccountRepository) {
        super('SeedCoaTemplate');
    }

    async run(_context: { data?: any }) {
        try {
            const existing = await this.chartOfAccountRepository.getTemplate();
            const existingAccountNumbers = new Set(existing.map(a => a.accountNumber));

            let inserted = 0;
            for (const templateAccount of TEMPLATE_ACCOUNTS) {
                if (existingAccountNumbers.has(templateAccount.accountNumber)) {
                    continue;
                }

                const account = new ChartOfAccount();
                account.oid = UniqueId(Common.uniqueId());
                account.accountNumber = templateAccount.accountNumber;
                account.name = templateAccount.name;
                account.statementType = templateAccount.statementType;
                account.category = templateAccount.category;
                account.subCategory = templateAccount.subCategory;
                account.sourceType = AccountSourceType.Manual;
                account.isTemplate = true;

                await this.chartOfAccountRepository.save(account);
                inserted++;
            }

            console.log(`SeedCoaTemplate: inserted ${inserted} new template account(s), ${TEMPLATE_ACCOUNTS.length - inserted} already present`);
            this.done({ success: true, data: { inserted } });
        }
        catch (err) {
            console.log(err);
            this.done({ success: false, data: err });
        }
    }
}
