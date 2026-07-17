import { Inject, Injectable } from 'injection-js';
import { Bootstrap } from '../../config/bootstrap';
import { SharedRepository } from '../../repository/ai/shared.repository';

import { AIAgent, AIMessage, AICompletionOptions, ChatGPTTool, AIToolChoice, AIModel } from '../../../model/ai.model';
import { ApiResponse } from '../base.service';
import { AppService } from '../app.service';
import { ChatGPTService } from './chatgpt.service';
import { GeminiService } from './gemini.service';
import { ClaudeService } from './claude.service';
import { AIServiceToken, IAIService } from './iai.service';
import { BaseAIService } from './base-ai.service';
import { authid } from '../../../model/id.model';

export const services = [ChatGPTService, GeminiService, ClaudeService]; //referenced only so they get bootstrapped...maybe a better way?

@Injectable()
@Bootstrap()
export class AIService extends BaseAIService implements IAIService {
    models: AIModel[];
    protected defaultOptions: AICompletionOptions = {};

    constructor(protected appService: AppService, protected sharedRepository: SharedRepository, @Inject(AIServiceToken) private aiServices: IAIService[]) {
        super(null, appService, sharedRepository);
    }

    getTextCompletions(messages: AIMessage<any>[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<any[]>> {
        return this.getService(options.model).getTextCompletions(messages, options, authId);
    }

    getFunctionCall(messages: AIMessage<any>[], tools: ChatGPTTool[], toolChoice: AIToolChoice, options: AICompletionOptions, authId: authid) {
        return this.getService(options.model).getFunctionCall(messages, tools, toolChoice, options, authId);
    }

    getEmbedding(text: string): Promise<number[]> {
        const chatGPT = this.aiServices.find(s => s.models.includes('gpt-5.4-mini')) as ChatGPTService;
        return chatGPT ? chatGPT.getEmbedding(text) : Promise.resolve([]);
    }

    async updateAgent(agent: AIAgent) {
        //const text = [agent.name, ...(agent.tags || [])].join(' ');
        try {
            agent.embedding = null;//await this.getEmbedding(text);
        }
        catch (_) { /* save proceeds; existing string matching still works */ }

        return this.agentRepository.update(agent);
    }

    private getService(model: AIModel) {
        const service = this.aiServices.find(c => c.models.includes(model));
        if(!service) {
            throw new Error(`No AI service found for model ${model}`);
        }
        
        return service;
    }
}