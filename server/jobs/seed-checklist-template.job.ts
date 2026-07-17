import { Bootstrap, Injectable } from '../config/bootstrap';
import { Job } from '../../model/job.model';
import { ChecklistTemplate, ChecklistTemplateItem } from '../../model/checklist-template.model';
import { Database, DatabaseConnection } from '../database/database';
import { UniqueId } from '../../model/id.model';
import { Common } from '../../utility/common';

// Placeholder starter checklist - NOT the full Vanderbilt Excel PreClose tab content (that requires
// the real source workbook). Replace/extend before relying on this for production seeding, same
// caveat as seed-coa-template.job.ts's TEMPLATE_ACCOUNTS.
const CATEGORIES: { category: string; order: number; items: ChecklistTemplateItem[] }[] = [
    {
        category: 'Cash/Escrows', order: 1, items: [
            { key: 'cash-bank-recs-complete', label: 'All bank reconciliations complete for the period', order: 1 },
            { key: 'cash-escrow-analysis-reviewed', label: 'Escrow analysis reviewed and tied to lender statements', order: 2 },
            { key: 'cash-outstanding-items-reviewed', label: 'Outstanding/stale reconciling items reviewed', order: 3 }
        ]
    },
    {
        category: 'AR/Prepaids/SLR', order: 2, items: [
            { key: 'ar-aging-reviewed', label: 'AR aging reviewed for delinquencies over 60 days', order: 1 },
            { key: 'prepaid-schedule-updated', label: 'Prepaid expense schedule updated and amortized', order: 2 },
            { key: 'slr-schedule-reviewed', label: 'Straight-line rent schedule reviewed for accuracy', order: 3 }
        ]
    },
    {
        category: 'AP/Accrued Expenses', order: 3, items: [
            { key: 'ap-aging-reviewed', label: 'AP aging reviewed for stale/duplicate invoices', order: 1 },
            { key: 'accruals-recorded', label: 'Recurring accruals recorded for the period', order: 2 },
            { key: 'ap-cutoff-reviewed', label: 'AP cutoff reviewed (invoices dated and posted in-period)', order: 3 }
        ]
    },
    {
        category: 'Debt/Equity/Sales Tax', order: 4, items: [
            { key: 'debt-schedule-tied', label: 'Debt schedule tied to lender statement balance', order: 1 },
            { key: 'equity-rollforward-reviewed', label: 'Owner equity rollforward reviewed', order: 2 },
            { key: 'sales-tax-filed', label: 'Sales/occupancy tax filed and reconciled for the period', order: 3 }
        ]
    },
    {
        category: 'GL Review', order: 5, items: [
            { key: 'gl-je-reviewed', label: 'All journal entries reviewed and properly supported', order: 1 },
            { key: 'gl-suspense-cleared', label: 'Suspense/clearing accounts cleared to zero', order: 2 },
            { key: 'gl-variance-explained', label: 'Material P&L variances vs. budget explained', order: 3 }
        ]
    },
    {
        category: 'CapEx/Fixed Assets/TI-LC', order: 6, items: [
            { key: 'capex-additions-reviewed', label: 'CapEx additions reviewed and properly capitalized', order: 1 },
            { key: 'fixed-asset-depreciation-reviewed', label: 'Depreciation schedule reviewed for completeness', order: 2 },
            { key: 'ti-lc-schedule-reviewed', label: 'TI/LC amortization schedule reviewed', order: 3 }
        ]
    }
];

@Injectable()
@Bootstrap()
export class SeedChecklistTemplateJob extends Job {
    constructor() {
        super('SeedChecklistTemplate');
    }

    async run(_context: { data?: any }) {
        try {
            // Deliberately bypasses ChecklistTemplateRepository/BaseRepository here: any write through
            // the normal repository path stamps _tid to whatever DeployConfig.INJECTED_TENANT_ID is at
            // script-run time (an empty string, not null/undefined - see ChecklistTemplateRepository's
            // constructor comment). An empty-string _tid does NOT match the {_tid: null} clause a real
            // tenant's searchGlobalObjects query relies on, so those rows would be invisible to every
            // tenant. Inserting through the raw collection instead leaves _tid entirely unset, which a
            // {_tid: null} query does match.
            const collection = Database.getMongo(DatabaseConnection.APP).collection('checklist_template');

            let inserted = 0;
            for (const template of CATEGORIES) {
                const existing = await collection.findOne({ category: template.category });
                if (existing) {
                    continue;
                }

                const doc: ChecklistTemplate = {
                    oid: UniqueId(Common.uniqueId()),
                    category: template.category,
                    order: template.order,
                    items: template.items
                };

                await collection.insertOne(doc as any);
                inserted++;
            }

            console.log(`SeedChecklistTemplate: inserted ${inserted} new category document(s), ${CATEGORIES.length - inserted} already present`);
            this.done({ success: true, data: { inserted } });
        }
        catch (err) {
            console.log(err);
            this.done({ success: false, data: err });
        }
    }
}
