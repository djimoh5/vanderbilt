import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';
import { DocType } from './source-document.model';

export class TenantConfig implements BaseModel {
    oid?: uniqueid;
    varianceTolerance: { dollar: number; percent: number };
    docTypeList: DocType[];
    coaTemplateRef?: uniqueid;
}
