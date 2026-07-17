export interface BaseEmail {
    _id?: string;
    to: string[],
    cc?: string[],
    bcc?: string[],
    replyTo?: string;
    from?: string;
    fromName?: string;
    subject: string;
    signature?: string;
    attachments?: EmailAttachment[];
    tags?: string[];
    important?: boolean;
    _u?: string;
}

export interface Email extends BaseEmail {
    _ts?: number;
    html: string;
    text?: string;
}

export interface EmailTemplate extends BaseEmail {
    template?: EmailTemplateTypes;
    toName?: string,
    title?: string;
    subTitle?: string;
    content?: string;
    buttonText?: string;
    buttonLink?: string;
    footer?: string;
    platformId?: number;
}

export enum AdminEmailListType {
    Admin = 1,
    Support = 2,
    Accounting = 3
}

export enum EmailTemplateTypes {
    None = '',
    Main = 'main-template'
}

export interface EmailAttachment {
    type: string;
    name: string;
    content: string;
    url: string;
}

export const EMAIL_ATTACHMENT_MB_SIZE = 25;
export const EMAIL_ATTACHMENT_MAX_SIZE = EMAIL_ATTACHMENT_MB_SIZE * Math.pow(1000, 2);
export const EMAIL_ATTACHMENT_QUEUE_LIMIT = 2 * Math.pow(1000, 2);

export interface EmailQueueItem {
    id?: string;
    email: Email | EmailTemplate;
    status: EmailStatus;
    accountId: string;
    messageId?: string;
    tags?: string[];
    metadata?: { [key: string]: any };
    _p?: number[];
    _ts?: number;
    _u?: string;
    startAt?: number;

    _tsu?: number;
    _uu?: string;

    //Used for re-processing failed items
    cloneFromId?: string;
    reQueueId?: string;
}

export enum EmailStatus {
    Error = -1,
    Pending = 1,
    Success = 2,
    Processing = 3,
    NotProcessed = 4,
    OnHold = 5, //used for when there is an issue that must be resolved before proceeding
    Unsubscribed = 6 //user has unsubscribed, removing themselves from the queue
}

export interface EmailQueueFilter {
    id?: string;
    platformId?: number;
    status?: EmailStatus;
}

export interface EmailTriggerConfig {
    id?: string;
    name?: string;
    fromEmail?: string;
    fromName?: string;
    subject: string;
    body: string;
    template: EmailTemplateTypes;
    linkName?: string;
    cc?: string;
    bcc?: string;
    replyToEmail?: string;
    contextId?: string;
    contextType?: number | string;
    active?: boolean;
    _p?: number[];
    attachments?: EmailAttachment[];

    title?: string;
    subTitle?: string;

    signature?: string;

    //virtual
    edited?: boolean;
    deleted?: boolean;
}

export interface DBEmailStats {
    _id?: string;
    eid: string;
    mid: string;
    cid: string;
    clicks: number;
    clicks_detail: { url: string, ip: string, location: string, ts: number }[];
    opens: number;
    opens_detail: { ip: string, location: string, ts: number }[];
    subject: string;
    email: string;
    sender: string;
    state: string;
    ts: number;
    tags: string[];
    metadata: { message_id, campaign_id };
    _p: number[];
    hook?: boolean;
}
