
import { Bootstrap, Injectable } from '../../config/bootstrap';

import { SharedRepository } from '../../repository/ai/shared.repository';

import { HttpService, PostOptions } from '../http.service';
import { ApiResponse } from '../base.service';
import { AppService } from '../app.service';

import { ChatGPTCompletionChoice, ChatGPTTool, AICompletionOptions, AIMessage, ChatGPTMessage, AIToolChoice, AIMaxTokens, ClaudeAPICallConfig, ClaudeCompletion, ClaudeMessage, ClaudeTool, ClaudeToolChoice } from '../../../model/ai.model';

import { Config } from '../../config/config';
import { IAIService, AIServiceToken } from './iai.service';
import { BaseAIService } from './base-ai.service';
import { authid } from '../../../model/id.model';

const util = require('util');

@Injectable()
@Bootstrap()
@Bootstrap(AIServiceToken)
export class ClaudeService extends BaseAIService implements IAIService {
    protected defaultOptions: AICompletionOptions = {
        model: 'claude-opus-4-7',
        maxTokens: AIMaxTokens.Mega,
        temperature: 0,
        logResponse: true
    };

    constructor(appService: AppService, sharedRepository: SharedRepository, private http: HttpService) {
        super(['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'], appService, sharedRepository);
    }

    async getTextCompletions(messages: AIMessage<any>[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        this.mergeDefaultConfig(options);
        const { system, claudeMessages } = this.mapMessages(messages);

        const config: ClaudeAPICallConfig = {
            model: options.model,
            max_tokens: options.maxTokens,
            messages: claudeMessages
        };

        if (system) {
            config.system = system;
        }

        if (options.responseFormat) {
            const schema = JSON.stringify(options.responseFormat.json_schema.schema, null, 2);
            config.system = (config.system ? config.system + '\n\n' : '') +
                `Respond with valid JSON matching this schema:\n${schema}`;
        }

        return this.callAPI(config, authId, options.logResponse);
    }

    async getFunctionCall(messages: AIMessage<any>[], tools: ChatGPTTool[], toolChoice: AIToolChoice = 'auto', options: AICompletionOptions, authId: authid) {
        this.mergeDefaultConfig(options);
        const { system, claudeMessages } = this.mapMessages(messages);

        const config: ClaudeAPICallConfig = {
            model: options.model,
            max_tokens: options.maxTokens,
            messages: claudeMessages,
            tools: this.mapTools(tools),
            tool_choice: this.mapToolChoice(toolChoice)
        };

        if (system) config.system = system;
        if (options.temperature !== undefined) config.temperature = options.temperature;

        console.log('CLAUDE FUNCTION CALL CONFIG', JSON.stringify(config, null, 2));
        return this.callAPI(config, authId, options.logResponse);
    }

    async groundedSearch(_query: string, _authId: authid): Promise<{ text: string; sources: Array<{ url: string; title: string }> }> {
        console.warn('ClaudeService: groundedSearch is not supported');
        return { text: '', sources: [] };
    }

    mapToolChoice(toolChoice: AIToolChoice): ClaudeToolChoice {
        switch (toolChoice) {
            case 'required': return { type: 'any' };
            case 'auto':
            default: return { type: 'auto' };
        }
    }

    mapTools(tools: ChatGPTTool[]): ClaudeTool[] {
        return tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters
        }));
    }

    mapMessages(messages: AIMessage<any>[]): { system: string; claudeMessages: ClaudeMessage[] } {
        let system = '';
        const claudeMessages: ClaudeMessage[] = [];

        for (const m of messages) {
            if (m.role === 'system') {
                system = typeof m.content === 'string' ? m.content : system;
                continue;
            }

            if (m.role === 'tool') {
                const toolMsg = m as ChatGPTMessage;
                claudeMessages.push({
                    role: 'user',
                    content: [{ type: 'tool_result', tool_use_id: toolMsg.tool_call_id, content: typeof m.content === 'string' ? m.content : '' }]
                });
                continue;
            }

            if (m.role === 'assistant' && m.tool_calls?.length) {
                claudeMessages.push({
                    role: 'assistant',
                    content: m.tool_calls.map(tc => ({
                        type: 'tool_use' as const,
                        id: tc.id,
                        name: tc.function.name,
                        input: JSON.parse(tc.function.arguments)
                    }))
                });
                continue;
            }

            claudeMessages.push({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: typeof m.content === 'string' ? m.content : ''
            });
        }

        return { system, claudeMessages };
    }

    private callAPI(config: ClaudeAPICallConfig, authId: authid, logResponse: boolean = true): Promise<ApiResponse<ChatGPTCompletionChoice[]>> {
        console.log(JSON.stringify(config));

        return new Promise<ApiResponse<ChatGPTCompletionChoice[]>>(resolve => {
            const options: PostOptions = {
                url: 'https://api.anthropic.com/v1/messages',
                body: JSON.stringify(config),
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': Config.CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                name: 'claude-completions'
            };

            this.http.post(options, (err, res: ClaudeCompletion) => {
                if (err) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(err, null, 2) }, authId);
                    resolve(new ApiResponse(false, [{ message: { content: err || 'Unknown error', role: 'assistant' } }]));
                    return;
                }

                const textBlock = res.content?.find(c => c.type === 'text') as { type: 'text'; text: string } | undefined;
                const toolUseBlocks = res.content?.filter(c => c.type === 'tool_use') as Array<{ type: 'tool_use'; id: string; name: string; input: any }>;

                const functionCalls = toolUseBlocks?.length
                    ? toolUseBlocks.map(tc => ({ id: tc.id, function: { name: tc.name, arguments: JSON.stringify(tc.input) } }))
                    : undefined;

                if (logResponse) {
                    this.aiLogRepository.log({ request: config, response: JSON.stringify(res, null, 2) }, authId);

                    if (textBlock?.text || functionCalls) {
                        console.log(`CLAUDE ${config.model} AI RESPONSE SUCCESS: `, textBlock?.text);
                    }
                    else {
                        console.log(`CLAUDE ${config.model} AI RESPONSE ERROR: `, util.inspect(res, { depth: null }));
                    }
                }

                resolve(new ApiResponse(true, [{ message: { content: textBlock?.text || '', role: 'assistant', tool_calls: functionCalls } }]));
            });
        });
    }
}
