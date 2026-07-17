
import { Bootstrap, Injectable } from '../../config/bootstrap';

import { SharedRepository } from '../../repository/ai/shared.repository';

import { HttpService, PostOptions } from '../http.service';
import { ApiResponse } from '../base.service';
import { AppService } from '../app.service';

//import { WebIntegrations } from '../../../model/error.model';
import { ChatGPTCompletionChoice, GeminiAPICallConfig, ChatGPTTool, AICompletionOptions, AIMessage, GeminiMessage, GeminiCompletion, ChatGPTToolCall, GeminiToolCall, GeminiToolChoice, AIToolChoice } from '../../../model/ai.model';
//import { userid } from '../../../model/user.model';

import { Config } from '../../config/config';
import { IAIService, AIServiceToken } from './iai.service';
import { BaseAIService } from './base-ai.service';
import { authid } from '../../../model/id.model';
import { AIMaxTokens } from '../../../model/ai.model';

const util = require('util');

@Injectable()
@Bootstrap()
@Bootstrap(AIServiceToken)
export class GeminiService extends BaseAIService implements IAIService {
    protected defaultOptions: AICompletionOptions = { 
        model: 'gemini-3.1-pro-preview',
        maxTokens: AIMaxTokens.Maximum,
        temperature: 0,
        logResponse: true
    };

    constructor(appService: AppService, sharedRepository: SharedRepository, private http: HttpService) {
        super(['gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'], appService, sharedRepository);
    }
 
    async getTextCompletions(messages: AIMessage<any>[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        this.mergeDefaultConfig(options);
        delete options.maxTokens; // Gemini uses generationConfig.maxOutputTokens instead of maxTokens

        const config: GeminiAPICallConfig = {
            model: <any>options.model,
            contents: this.mapMessages(messages, options),
            generationConfig: {}
        };

        if(options.model !== 'gemini-2.5-flash') {
            config.generationConfig.thinkingConfig = { thinkingLevel: "low" };
        }

        if(options.responseFormat) {
            config.generationConfig.responseMimeType = 'application/json';
            config.generationConfig.responseJsonSchema = options.responseFormat.json_schema.schema;
        }
        else {
            config.generationConfig.maxOutputTokens = options.maxTokens;
        }

        return this.callAPI(config, authId, options.logResponse);
    }

    async getFunctionCall(messages: AIMessage<any>[], tools: ChatGPTTool[], toolChoice: AIToolChoice = 'auto', options: AICompletionOptions, authId: authid) {
        this.mergeDefaultConfig(options);

        const config: GeminiAPICallConfig = {
            model: <any>options.model,
            contents: this.mapMessages(messages, options),
            tools: [{ functionDeclarations: tools.map(t => t.function) }],
            toolConfig: { functionCallingConfig: { mode: this.mapToolChoice(toolChoice) } },
            generationConfig: {}
        };

        if(options.model !== 'gemini-2.5-flash') {
            config.generationConfig.thinkingConfig = { thinkingLevel: "low" };
        }

        console.log('FUNCTION CALL CONFIG', JSON.stringify(config, null, 2));
        return this.callAPI(config, authId, options.logResponse);
    }

    async groundedSearch(query: string, authId: authid): Promise<{ text: string; sources: Array<{ url: string; title: string }> }> {
        const config: GeminiAPICallConfig = {
            model: 'gemini-3-flash-preview',
            contents: <any>[{ role: 'user', parts: [{ text: query }] }],
            generationConfig: {},
            tools: [{ google_search: {} }]
        };
        const result = await this.callAPI(config, authId);
        const message = result.data[0]?.message;
        return {
            text: message?.content as string || '',
            sources: message?.groundingSources || []
        };
    }

    mapToolChoice(toolChoice: AIToolChoice): GeminiToolChoice {
        switch(toolChoice) {
            case 'auto': return 'AUTO';
            case 'required': return 'ANY';
            default: return 'AUTO';
        }
    }

    mapMessages(messages: AIMessage<any>[], options: AICompletionOptions): GeminiMessage[] {
        return messages.map(m => ({ 
            role: m.role === 'assistant' ? 'model' : (options.model === 'gemini-2.5-flash' ? 'user' : m.role), 
            parts: typeof m.content === 'string' ? 
                [{ text: m.content }] :
                m.content.map(c => ({ text: c.text }))
        }));
    }  

    private callAPI(config: GeminiAPICallConfig, authId: authid, logResponse: boolean = true): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        //console.log(JSON.stringify(config));
        
        return new Promise<ApiResponse<ChatGPTCompletionChoice[]>>(resolve => {
            const options: PostOptions = {
                url: `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
                body: JSON.stringify(config),
                headers: {
                    'x-goog-api-key': Config.GEMINI_API_KEY,
                    'Content-Type': 'application/json'
                },
                name: 'gemini-completions'
            };

            this.http.post(options, (err, res: GeminiCompletion) => {
                if(err) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(err, null, 2) }, authId);
                    resolve(new ApiResponse(false, [{ message: { content: err || 'Unknown error', role: 'assistant' } }]));
                    return;
                }

                const responseText = res.candidates?.[0]?.content?.parts?.[0]?.text;
                const resFunctionCalls: GeminiToolCall[] = res.candidates?.[0]?.content?.parts?.map(p => p.functionCall).filter(fc => fc != null);
                let functionCalls: ChatGPTToolCall[];

                if(resFunctionCalls && resFunctionCalls.length > 0) {
                    functionCalls = resFunctionCalls.map(fc => ({ id: null, function: { name: fc.name, arguments: JSON.stringify(fc.args) }}));
                }

                const groundingChunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const groundingSources = groundingChunks
                    .filter(c => c.web)
                    .map(c => ({ url: c.web.uri, title: c.web.title }));

                if (logResponse) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(res, null, 2) }, authId);

                    if(responseText || functionCalls) {
                        //`console.log(`GEMINI ${config.model} AI RESPONSE SUCCESS: `, responseText);
                    }
                    else {
                        console.log(`GEMINI ${config.model} AI RESPONSE ERROR: `, util.inspect(res, { depth: null }));
                    }
                }

                resolve(new ApiResponse(true, [{ message: { content: responseText || '', role: 'assistant', tool_calls: functionCalls, groundingSources: groundingSources.length ? groundingSources : undefined } }]));
            });
        });
    }
}