import { Bootstrap, Injectable } from "../../config/bootstrap";
import { BaseRepository } from "../base.repository";
import { AIConversation } from "../../../model/ai.model";

@Injectable()
@Bootstrap()
export class ConversationRepository extends BaseRepository {
    constructor() {
        super('conversation');
    }

    getByAgentId(agentId: string): Promise<AIConversation<any>[]> {
        return this.context.find({ agentId: agentId });
    }

    update(conversation: AIConversation<any>): Promise<AIConversation<any>> {
        return this.updateObject<AIConversation<any>>(<any>{ oid: conversation.oid, messages: conversation.messages.map(m => ({ ...m, data: undefined })), messageIndex: conversation.messageIndex }, { agentId: conversation.agentId });
    }
}