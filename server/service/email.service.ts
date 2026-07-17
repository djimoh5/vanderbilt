import { BaseService, ApiResponse, ApiErrorResponse } from './base.service';

import { EmailTemplate, Email, EmailTemplateTypes, BaseEmail, EMAIL_ATTACHMENT_MAX_SIZE, EMAIL_ATTACHMENT_MB_SIZE, EMAIL_ATTACHMENT_QUEUE_LIMIT, DBEmailStats } from '../../model/email.model';

import { Config } from '../config/config';
import { Bootstrap, Injectable } from '../config/bootstrap';

import { EmailLogRepository } from '../repository/email-log.repository';

import { AppService } from '../service/app.service';
import { HttpService } from '../service/http.service';
import { ErrorService } from '../service/error.service';

//import { EmailAlertEvent, EmailSentEvent, EmailTriggerEvent } from '../../event/email.event';

import { Common } from '../../utility/common';
import { ErrorType } from '../../model/error.model';

import { HtmlSpecialCharacters } from '../../model/html-special-characters';
import { authid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class EmailService extends BaseService {
    static MAX_FILE_SIZE = EMAIL_ATTACHMENT_MAX_SIZE; //25MB
    static MB_FILE_SIZE = EMAIL_ATTACHMENT_MB_SIZE;
    static QUEUE_FILE_SIZE = EMAIL_ATTACHMENT_QUEUE_LIMIT;

    sendEmailEndpoint = 'messages/send.json';
    sendTemplateEndpoint = 'messages/send-template.json';
    searchEndpoint = 'messages/search.json';
    addSenderDomainEndpoint = 'senders/add-domain.json';
    getSenderDomainEndpoint = 'senders/check-domain.json';
    getTagInfo = 'tags/info';

    constructor(appService: AppService, private http: HttpService, private errorService: ErrorService, private emailLogRepository: EmailLogRepository) {
        super(appService);
    }
 
    async sendTemplate(template: EmailTemplate, userId: string, tags?: string[], metadata?: { [key: string]: any }): Promise<ApiResponse<any>> {
        /*if(Config.ENVIRONMENT !== 'release') {
            template.subject += this.getTestInfo(template.to, template.cc, template.bcc, platform, Config.ENVIRONMENT, template.doNotArchive);
            template.to = Config.EMAIL.admin;

            if (platform.email && platform.email.testing){
                template.to.push(...platform.email.testing);
            }

            if(template.cc && template.cc.length > 0) {
                template.cc = [Config.EMAIL.admin[0]];
            }

            if(template.bcc && template.bcc.length > 0) {
                template.bcc = [Config.EMAIL.admin[0]];
            }
        }*/

        if (template.signature) {
            template.content += template.signature;
        }
        
        const globalMergeVars = [
            { name: "name", content: template.toName },
            { name: "title", content: template.title || '' },
            { name: "sub_title", content: template.subTitle || '' },
            { name: "main_content", content: this.sanitize(template.content || '') },
            { name: "footer_content", content: this.sanitize(template.footer || '') },
            { name: "button_link", content: template.buttonLink },
            { name: "button_text", content: this.sanitize(template.buttonText) }
        ];

        const body = {
            key: null,
            template_name: template.template || EmailTemplateTypes.Main,
            template_content: [{ name:'', content:'' }],
            message: {
                preserve_recipients: true,
                subject: this.sanitize(template.subject),
                from_email: template.from || Config.EMAIL.from,
                from_name: Config.EMAIL.fromName,
                to: template.to.map(t => { 
                    return {
                        email: t,
                        type: 'to'
                    }; 
                }),
                headers: {
                    "Reply-To": template.replyTo || template.from || Config.EMAIL.from
                },
                important: !!template.important,
                track_opens: true,
                track_clicks: true,
                global_merge_vars: globalMergeVars,
                tags: [],
                attachments: this.mapAttachments(template)
            }
        };

        const messageSize = body.message.attachments.map(a => a.content.length).reduce((pv, cv) => pv + cv, 0);
        if (messageSize >= EmailService.MAX_FILE_SIZE) {
            const message = `Attachments exceeds maximum file size of ${EmailService.MB_FILE_SIZE}MB`;
            this.errorService.log(message, ErrorType.CaughtException, userId as authid);
            return new ApiErrorResponse(message);
        }

        await this.addEmailTracking(template, body, tags, metadata);

        const res = await this.post(userId, body, this.sendTemplateEndpoint, Config.MANDRILL_API_KEY);
        return this.logEmail(res, template, userId);
    }

    async sendEmail(email: Email, userId: string, tags?: string[], metadata?: { [key: string]: any }) {
        if(Config.ENVIRONMENT !== 'release') {
            email.subject += this.getTestInfo(email.to, email.cc, email.bcc, Config.ENVIRONMENT);
            email.to = Config.EMAIL.admin;

            if(email.cc && email.cc.length > 0) {
                email.cc = [Config.EMAIL.admin[0]];
            }
        }

        if (email.signature) {
            if(email.html) {
                email.html += email.signature;
            }
            else if(email.text) {
                email.text += email.signature;
            }
        }

        if(email.html) {
            email.html = email.html.replace(/<p>/g, '<p style="margin:0">');
            if(!email.text) {
                email.text = email.html.replace(/<br\/>/g, '\n').replace(/<br>/g, '\n');
            }
        }

        const body = {
            key: null,
            message: {
                preserve_recipients: true,
                html: this.sanitize(email.html),
                text: this.sanitize(email.text),
                auto_text: !email.text,
                subject: this.sanitize(email.subject),
                from_email: email.from || Config.EMAIL.from,
                from_name: this.sanitize(email.fromName || Config.EMAIL.fromName),
                to: email.to.map(t => { 
                    return {
                        email: t,
                        type: 'to'
                    }; 
                }),
                headers: {
                    "Reply-To": email.replyTo || email.from || Config.EMAIL.from
                },
                important: !!email.important,
                track_opens: true,
                track_clicks: true,
                tags: [],
                attachments: this.mapAttachments(email)
            }
        };

        const messageSize = body.message.attachments.map(a => a.content.length).reduce((pv, cv) => pv + cv, 0);
        if (messageSize >= EmailService.MAX_FILE_SIZE) {
            const message = `Attachments exceeds maximum file size of ${EmailService.MB_FILE_SIZE}MB`;
            this.errorService.log(message, ErrorType.CaughtException, userId as authid);
            return new ApiErrorResponse(message);
        }

        await this.addEmailTracking(email, body, tags, metadata);

        const res = await this.post(userId, body, this.sendEmailEndpoint, Config.MANDRILL_API_KEY);
        return this.logEmail(res, email, userId);
    }

    private mapAttachments(email: BaseEmail) {
        return email.attachments ? email.attachments.map(a => { return { name: a.name, type: a.type, content: a.content }; }) : [];
    }

    private async logEmail(res: ApiResponse<any>, email: Email | EmailTemplate, userId: string) {
        if(res.success) {
            if(email.attachments) {
                email.attachments = email.attachments.map(a => { return { ...a, content: null }; });
            }

            email = await this.emailLogRepository.add(email, res.data, userId);
            
            if (typeof res.data === 'object'){
                res.data.emailId = email._id;
            }
            else {
                res.data = {
                    response: res.data,
                    emailId: email._id
                };
            }
        }

        return res;
    }

    async getByEmailId(emailId: string) {
        const email = await this.emailLogRepository.getById(emailId);
        if(email) {
            return new ApiResponse(true, email);
        }

        return new ApiErrorResponse(`email with ID ${emailId} does not exist`);
    }


    private async addEmailTracking(email: Email | EmailTemplate, body: any, tags: string[], metadata: { [key: string]: any }) {
        if(email.cc) {
            email.cc.forEach(email => {
                body.message.to.push({ email: email.trim(), type: 'cc' });
            });
        }

        if(email.bcc) {
            email.bcc.forEach(email => {
                body.message.to.push({ email: email.trim(), type: 'bcc' });
            });
        }

        if(tags) {
            body.message.tags = tags;
            email.tags = tags;
        }
        else if(email.tags) {
            body.message.tags = email.tags;
        }

        if(metadata) {
            body.message['metadata'] = metadata;
        }
    }

    async getMessageStats(userId: string, platformId?: number, metaQuery?: { [key: string]: any }, tsRange?: [number, number], lookbackDays?: number) {
        const allRes = new ApiResponse<DBEmailStats[]>(true, []);

        const hasAppTag = await this.hasAppTag(userId);
        if (!hasAppTag) {
            return allRes;
        }

        let res: ApiResponse<DBEmailStats[]>;

        while(!res || res.data.length === 1000) {
            res = await this.getMessageStatsHelper(userId, platformId, metaQuery, tsRange, lookbackDays);
            if(res.data) {
                console.log(res.data.length);
                allRes.data = allRes.data.concat(res.data);

                if(res.data[0] && res.data[0].ts > res.data[res.data.length - 1].ts) {
                    //console.log('platform', platformId, res.data.length, res.data[res.data.length - 1].ts, res.data[0].ts);
                    tsRange = [res.data[res.data.length - 1].ts - 5000, res.data[res.data.length - 1].ts];
                }
            }
            else {
                res.data = [];
            }
        }

        return allRes;
    }

    private async getMessageStatsHelper(userId: string, platformId: number, metaQuery?: { [key: string]: any }, tsRange?: [number, number], lookbackDays?: number) {
        const date = new Date();
        const dateTo = `${Common.formatDate(date, Common.DateFormat.sqlDate)}`;
        date.setDate(date.getDate() - (lookbackDays || 5));
        const dateFrom = `${Common.formatDate(date, Common.DateFormat.sqlDate)}`;

        const params: { query?: string, tags?: string[], limit: number, date_from: string, date_to: string, senders?: string[] } = {
            date_from: dateFrom,
            date_to: dateTo,
            tags: [`p${platformId}`],
            limit: 1000
        };

        if(tsRange) {
            params.query = `ts: [${tsRange[0]} TO ${tsRange[1]}]`;
        }
        
        //let subject = 'subject:Raise capital 10x faster (300+ M in 12 months)';
        //params.query = params.query ? `${params.query} AND ${subject}` : subject;

        if(metaQuery) {
            if(!params.query) {
                params.query = '';
            }

            for(const key in metaQuery) {
                params.query += (params.query ? ' AND ' : '') + `u_${key}:${metaQuery[key]}`;
            }
        }

        return this.post(userId, params, this.searchEndpoint, Config.MANDRILL_API_KEY);
    }

    private async hasAppTag(userId: string) {
        const response = await this.post(userId, { tag: Config.EMAIL.tag }, this.getTagInfo, Config.MANDRILL_API_KEY);
        return response.success;
    }

    private post(userId: string, postData: { [key: string]: any }, endpoint: string, apiKey?: string, isRetry?: boolean): Promise<ApiResponse<any>> {
        return new Promise(resolve => {
            postData.key = apiKey || Config.MANDRILL_API_KEY;
            const content = JSON.stringify(postData);

            const messageName = (postData.message && postData.message.subject);

            console.log(`Send Data: ${messageName || endpoint}`);
            console.log(`\t${Config.MANDRILL.API_URL}/${endpoint}`);

            const postOptions = {
                url: `${Config.MANDRILL.API_URL}/${endpoint}`,
                body: content,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': content.length
                },
                name: messageName,
                userId: userId,
                secureKeys: ['key']
            };
            this.http.post(postOptions, (_err, res, _data, statusCode) => {
                if (!statusCode || statusCode >= 500 || statusCode === 408) { //server error or timeout
                    if (isRetry) {
                        resolve({ success: false }); //don't log invalid requests
                    }
                    else {
                        return this.post(userId, postData, endpoint, apiKey, true);
                    }
                }
                else if(res.status && res.status === 'error') {
                    if(res.message && res.message.indexOf('invalid tags') > 0) {
                        resolve({ success: false }); //don't log invalid tag requests
                    }
                    else if (res.message) {
                        resolve({ success: false, msg: res.message });
                    }
                    else if(res.message && (res.message.indexOf('complaint') >= 0 || res.message.indexOf('spam') >= 0 || res.message.indexOf('bounce') >= 0)) {
                        resolve({ success: false, msg: res.message });
                    }
                    else if (res.message && res.message.includes('specify a key')) {
                        const data = Object.assign({}, postData);
                        if (data.message) {
                            const message = data.message;
                            delete data.message;
                            data['email'] = message;
                        }

                        this.errorService.log(`API error: Missing or invalid API key`, ErrorType.CaughtException, userId as authid, { endpoint: endpoint, postData: data });
                        resolve({ success: false, msg: `API error: Message has incorrect formatting (${res.message})` });
                    }
                    else {
                        this.errorService.log(`API error: Missing or invalid API key`, ErrorType.CaughtException, userId as authid, { endpoint: endpoint });
                        resolve({ success: false, msg: `API error: ${res.message}` });
                    }
                }
                else if(res[0] && res[0].reject_reason && (res[0].reject_reason.indexOf('complaint') >= 0 || res[0].reject_reason.indexOf('spam') >= 0 || res[0].reject_reason.indexOf('bounce') >= 0)) {
                    resolve({ success: false, msg: res.message });
                }
                else if(res[0] && res[0].reject_reason) {
                    this.errorService.log(`API error: ${res[0].reject_reason}`, ErrorType.CaughtException, userId as authid, { endpoint: endpoint });
                    resolve({ success: false, msg: `API error: ${res[0].reject_reason}` });
                }
                else {
                    resolve({ success: true, data: res });
                }
            });
        });
    }

    addSendingDomain(userId: string, domain: string): Promise<{ domain: string, spf: { valid: boolean, error: string }, dkim: { valid: boolean, error: string }, verified_at: string, valid_signing: boolean }> {
        return this.post(userId, { domain: domain }, this.addSenderDomainEndpoint).then(res => {
            console.log(res);
            if(res.success) {
                return res.data;
            }
        });
    }

    getSendingDomain(userId: string, domain: string): Promise<{ domain: string, spf: { valid: boolean, error: string }, dkim: { valid: boolean, error: string }, verified_at: string, valid_signing: boolean, verify_txt_key: string }> {
        return this.post(userId, { domain: domain }, this.getSenderDomainEndpoint).then(res => {
            console.log(res);
            if(res.success) {
                return res.data;
            }
        });
    }
    
    sanitize(str: string) {
        if(str) {
            for(const char in HtmlSpecialCharacters) {
                str = str.replace(new RegExp(char, 'g'), HtmlSpecialCharacters[char]);
            }
        }

        return str;
    }

    private getTestInfo(to: string[], cc: string[], bcc: string[], environment: string) {
        return ` (To: ${to.join('; ')}${cc && cc.length > 0 ? (', CC: ' + cc.join('; ')) : ''}${bcc && bcc.length > 0 ? (', BCC: ' + bcc.join('; ')) : ''}, Env: ${environment})`;
    }
}