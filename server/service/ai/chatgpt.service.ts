
import { Bootstrap, Injectable } from '../../config/bootstrap';

import { SharedRepository } from '../../repository/ai/shared.repository';

import { HttpService, PostOptions } from '../http.service';
import { ApiResponse } from '../base.service';
import { AppService } from '../app.service';

//import { WebIntegrations } from '../../../model/error.model';
import { ChatGPTCompletion, ChatGPTCompletionChoice, ChatGPTMessage, ChatGPTAPICallConfig, ChatGPTTool, AICompletionOptions, AIMaxTokens, AIToolChoice, ChatGPTWebSearchResponse } from '../../../model/ai.model';
//import { userid } from '../../../model/user.model';

import { Config } from '../../config/config';
import { BaseAIService } from './base-ai.service';
import { IAIService, AIServiceToken } from './iai.service';
import { authid } from '../../../model/id.model';

const util = require('util');

@Injectable()
@Bootstrap()
@Bootstrap(AIServiceToken)
export class ChatGPTService extends BaseAIService implements IAIService {
    protected defaultOptions: AICompletionOptions = { 
        maxTokens: AIMaxTokens.Maximum,
        model: 'gpt-5.2',
        temperature: 0,
        logResponse: true 
    };
    
    constructor(appService: AppService, sharedRepository: SharedRepository, private http: HttpService) {
        super(['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano'], appService, sharedRepository);
    }
 
    async getTextCompletions(messages: ChatGPTMessage[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        this.mergeDefaultConfig(options);

        const config: ChatGPTAPICallConfig = {
            model: options.model,
            messages: messages
        };

        if(options.model === 'gpt-5.2') {
            config.reasoning_effort = 'medium';
        }

        if(options.responseFormat) {
            config.response_format = options.responseFormat;
        }

        return this.callAPI(config, authId, options.logResponse);
    }

    async getFunctionCall(messages: ChatGPTMessage[], tools: ChatGPTTool[], toolChoice: AIToolChoice = 'auto', options: AICompletionOptions, authId: authid) {
        this.mergeDefaultConfig(options);

        const config: ChatGPTAPICallConfig = {
            model: options.model,
            messages: messages,
            tools: tools,
            tool_choice: toolChoice
        };

        if(options.model === 'gpt-5.2') {
            config.reasoning_effort = 'none';
        }
        
        return this.callAPI(config, authId, options.logResponse);
    }

    async groundedSearch(query: string, authId: authid): Promise<{ text: string; sources: Array<{ url: string; title: string }> }> {
        const request = {
            model: 'gpt-5',
            tools: [{ type: 'web_search' }],
            input: query
        };

        return new Promise((resolve, reject) => {
            const options: PostOptions = {
                url: 'https://api.openai.com/v1/responses',
                body: JSON.stringify(request),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.OPEN_AI_KEY}`
                },
                name: 'chatgpt-grounded-search'
            };

            this.http.post(options, (err, res: ChatGPTWebSearchResponse) => {
                if (err) {
                    this.aiLogRepository.log({ request, response: JSON.stringify(err, null, 2) }, authId);
                    return reject(err);
                }

                this.aiLogRepository.log({ request, response: JSON.stringify(res, null, 2) }, authId);

                const messageOutput = res.output?.find(o => o.type === 'message');
                const textContent = messageOutput?.content?.find(c => c.type === 'output_text');
                const text = res.output_text || textContent?.text || '';
                const sources = (textContent?.annotations || [])
                    .filter(a => a.type === 'url_citation')
                    .map(a => ({ url: a.url, title: a.title }));

                resolve({ text, sources });
            });
        });
    }

    getEmbedding(text: string): Promise<number[]> {
        return new Promise(resolve => {
            const options: PostOptions = {
                url: 'https://api.openai.com/v1/embeddings',
                body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.OPEN_AI_KEY}`
                },
                name: 'openai-embedding'
            };

            this.http.post(options, (err, res: { data: Array<{ embedding: number[] }> }) => {
                resolve(!err && res?.data?.[0]?.embedding || []);
            });
        });
    }

    private callAPI(config: ChatGPTAPICallConfig, authId: authid, logResponse: boolean = true): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        console.log(JSON.stringify(config));

        return new Promise<ApiResponse<ChatGPTCompletionChoice[]>>(resolve => {
            const options: PostOptions = {
                url: 'https://api.openai.com/v1/chat/completions',
                body: JSON.stringify(config),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.OPEN_AI_KEY}`
                },
                name: 'completions'
            };

            this.http.post(options, (err, res: ChatGPTCompletion) => {
                if(err) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(err, null, 2) }, authId);
                    resolve(new ApiResponse(false, [{ message: { content: err || 'Unknown error', role: 'assistant' } }]));
                    return;
                }

                if (logResponse) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(res, null, 2) }, authId);

                    if(res.choices && res.choices.length > 0 && res.choices[0].message) {
                        console.log(`CHATGPT ${config.model} AI RESPONSE SUCCESS: `, res.choices[0].message.content);
                    }
                    else {
                        console.log(`CHATGPT ${config.model} AI RESPONSE ERROR: `, util.inspect(res, { depth: null }));
                    }
                }
               
                resolve(new ApiResponse(true, res.choices));
            });
        });
    }
}