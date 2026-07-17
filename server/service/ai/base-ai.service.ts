import { SharedRepository } from '../../repository/ai/shared.repository';

import { AIAgent, AIConversation, AIMessage, AICompletionOptions, ChatGPTTool, AIToolChoice, AIModel } from '../../../model/ai.model';
import { BaseService, ApiResponse } from '../base.service';
import { AppService } from '../app.service';
import { Common } from '../../../utility/common';
import { IAIService } from './iai.service';
import { authid } from '../../../model/id.model';

export abstract class BaseAIService extends BaseService implements IAIService {
    protected defaultOptions: AICompletionOptions = {};

    constructor(public models: AIModel[], protected appService: AppService, protected sharedRepository: SharedRepository) {
        super(appService);
    }

    abstract getTextCompletions(messages: AIMessage<any>[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<any[]>>;

    abstract getFunctionCall(messages: AIMessage<any>[], tools: ChatGPTTool[], toolChoice: AIToolChoice, options: AICompletionOptions, authId: authid);

    async executeConversation<T>(conversation: AIConversation<T>, options: AICompletionOptions, authId: authid): Promise<AIMessage<T>> {
        options = { ...this.defaultOptions, ...options };

        let res = await this.getTextCompletions(conversation.messages.slice(conversation.messageIndex || 0), options, authId);
        const message = <AIMessage<T>>res.data[0].message;

        if (message.content) {
            ``
            message.content = this.sanitizeContent(message.content);
        }

        if (options.responseFormat) {
            if (options.responseFormat.type === 'json_schema') {
                const content = <string>message.content;
                try {
                    message.json = JSON.parse(content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1));
                }
                catch (_ex) {
                    console.error('Error parsing JSON response', content);
                }
            }
        }

        conversation.add(message);

        return message;
    }

    async executeFunctionCall<T>(conversation: AIConversation<T>, tools: ChatGPTTool[], toolChoice: AIToolChoice, options: AICompletionOptions, authId: authid): Promise<AIMessage<T>> {
        options = { ...this.defaultOptions, ...options };

        let res = await this.getFunctionCall(conversation.messages.slice(conversation.messageIndex || 0), tools, toolChoice, options, authId);
        const message = <AIMessage<T>>res.data[0].message;

        if (message.content) {
            message.content = this.sanitizeContent(message.content);
        }

        if (options.responseFormat) {
            if (options.responseFormat.type === 'json_schema') {
                const content = <string>message.content;
                try {
                    message.json = JSON.parse(content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1));
                }
                catch (_ex) {
                    console.error('Error parsing JSON response', content);
                }
            }
        }

        conversation.add(message);

        return message;
    }

    updateConversation(conversation: AIConversation<any>) {
        return this.conversationRepository.update(conversation);
    }

    updateAgent(agent: AIAgent) {
        return this.agentRepository.update(agent);
    }

    removeAgent(agentId: string) {
        return this.agentRepository.removeObject(agentId);
    }

    getAllAgents(networkId: string, limit?: number) {
        return this.agentRepository.getAll(networkId, limit);
    }

    getAgentById(agentId: string) {
        return this.agentRepository.getAgent(agentId);
    }

    protected sanitizeContent(content: any) {
        if (content.replace) {
            content = content.replace('```json', '').replace('```html', '');
        }

        return content;
    }

    protected mergeDefaultConfig(options: AICompletionOptions) {
        for (let key in this.defaultOptions) {
            if (!Common.isDefined(options[key])) {
                options[key] = this.defaultOptions[key];
            }
        }
    }

    protected get agentRepository() { return this.sharedRepository.agentRepository; }
    protected get contextRepository() { return this.sharedRepository.contextRepository; }
    protected get conversationRepository() { return this.sharedRepository.conversationRepository; }
    protected get aiLogRepository() { return this.sharedRepository.aiLogRepository; }
}