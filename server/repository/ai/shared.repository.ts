
import { Bootstrap, Injectable } from '../../config/bootstrap';

import { ConversationRepository } from './conversation.repository';
import { AgentRepository } from './agent.repository';
import { ContextRepository } from './context.repository';
import { AILogRepository } from './ai-log.repository';

@Injectable()
@Bootstrap()
export class SharedRepository {
    constructor(
        public agentRepository: AgentRepository, 
        public contextRepository: ContextRepository, 
        public conversationRepository: ConversationRepository,
        public aiLogRepository: AILogRepository
    ) {}
}