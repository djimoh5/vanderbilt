import { BaseRepository } from './base.repository';

import { Bootstrap, Injectable } from '../config/bootstrap';
import { Email, EmailTemplate } from '../../model/email.model';
import { DatabaseConnection } from '../database/database';

@Injectable()
@Bootstrap()
export class EmailLogRepository extends BaseRepository {
    constructor() {
        super('email_log', { connection: DatabaseConnection.LOG });
    }

    add(email: Email | EmailTemplate, response: any, auditUserId: string, type: 'mandrill' | 'twilio' = 'mandrill'): Promise<Email | EmailTemplate> {
        email[type] = response;
        return this.context.insert(email, auditUserId);
    }

    getById(emailId: string): Promise<Email | EmailTemplate> {
        return this.context.findOne({ _id: this.dbObjectId(emailId) });
    }
}