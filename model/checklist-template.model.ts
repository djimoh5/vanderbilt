import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export interface ChecklistTemplateItem {
    key: string;
    label: string;
    order: number;
}

// One document per category. Seeded as tenant-agnostic reference data (no _tid) - see
// server/jobs/seed-checklist-template.job.ts for why that seed bypasses the normal repository
// save path.
export class ChecklistTemplate implements BaseModel {
    oid?: uniqueid;
    category: string; // e.g. 'Cash/Escrows', 'AR/Prepaids/SLR', 'AP/Accrued Expenses', 'Debt/Equity/Sales Tax', 'GL Review', 'CapEx/Fixed Assets/TI-LC'
    order: number;
    items: ChecklistTemplateItem[];
}
