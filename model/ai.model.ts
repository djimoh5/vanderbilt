import { Common } from "../utility/common";
import { uniqueid } from "./id.model";
import { GenericMap, Virtual } from "./shared.model";

export interface ChatGPTAPICallConfig {
    model: AIModel;
    messages: ChatGPTMessage[],
    tools?: ChatGPTTool[],
    tool_choice?: ChatGPTToolChoice,
    max_tokens?: number;
    max_completion_tokens?: number;
    temperature?: number;
    response_format?: ChatGPTResponseFormat;
    reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
}

export interface GeminiAPICallConfig {
    model: AIModel,
    contents: { parts: { text: string }[] }[],
    maxOutputTokens?: number;
    temperature?: number;
    generationConfig: {
        maxOutputTokens?: number,
        thinkingConfig?: {
            thinkingLevel: 'low' | 'high';
        },
        responseMimeType?: 'application/json',
        responseJsonSchema?: AIResponseFormatSchema
    };
    tools?: GeminiTool[];
    toolConfig?: {
        functionCallingConfig: {
            mode: GeminiToolChoice,
            allowedFunctionNames?: string[]
        }
    }
}

export type ClaudeContentBlock =
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: any }
    | { type: 'tool_result'; tool_use_id: string; content: string };

export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string | ClaudeContentBlock[];
}

export interface ClaudeTool {
    name: string;
    description: string;
    input_schema: ChatGPTToolParam;
}

export interface ClaudeAPICallConfig {
    model: AIModel;
    max_tokens: number;
    messages: ClaudeMessage[];
    system?: string;
    tools?: ClaudeTool[];
    tool_choice?: ClaudeToolChoice;
    temperature?: number;
}

export interface ClaudeCompletion {
    id: string;
    type: 'message';
    role: 'assistant';
    model: string;
    content: ClaudeContentBlock[];
    stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
    error?: {
        type: string;
        message: string;
    };
}

export type ChatGPTModel = 'gpt-5.2' | 'gpt-5-mini' | 'gpt-5-nano';
export type GeminiModel = 'gemini-3-pro-preview' | 'gemini-3-pro-image-preview' | 'gemini-2.5-flash' | 'gemini-3-flash-preview' | 'gemini-3.1-pro-preview';
export type ClaudeModel = 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5';
export type AIModel = ChatGPTModel | GeminiModel | ClaudeModel;
export var AIModels: AIModel[] = ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'];

export type AIToolChoice = 'auto' | 'required';
export type ChatGPTToolChoice = 'auto' | 'required';
export type GeminiToolChoice = 'AUTO' | 'ANY' |  'NONE' | 'VALIDATED';
export type ClaudeToolChoice = { type: 'auto' } | { type: 'any' } | { type: 'none' };

export interface AIMessage<T> {
    role: 'system' | 'user'| 'assistant' | 'tool' | 'model';
    content?: string | { type: 'text' | 'image_url' | 'file', text?: string, image_url?: { url: string }, file?: string }[] | { parts: { text: string }[] }[];
    tool_calls?: ChatGPTToolCall[];

    json?: any;
    data?: T[];
    agentId?: string;
    isContext?: boolean;
    isMemory?: boolean;
    isFilter?: boolean;
}

export interface ChatGPTMessage extends AIMessage<any> {
    tool_call_id?: string;
    name?: string; //function name when passing role = tool with a function response
    groundingSources?: Array<{ url: string; title: string }>;
}

export interface GeminiMessage extends AIMessage<any> {
    parts: { text: string }[];
    tool_calls?: ChatGPTToolCall[];
}

export interface ChatGPTToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    }
}

export interface GeminiToolCall {
    name: string;
    args: string;
}

export interface ChatGPTCompletionChoice {
    finish_reason?: string;
    index?: number;
    message: ChatGPTMessage;
}

export interface ChatGPTCompletion {
    id: string;
    model: AIModel;
    object: 'text_completion';
    created: number;
    choices: ChatGPTCompletionChoice[];
    usage: {
        completion_tokens: string;
        prompt_tokens: string;
        total_tokens: string;
    }
    error?: {
        message: string;
    }
}

export interface ChatGPTWebSearchResponse {
    output_text?: string;
    output?: Array<{
        type: string;
        content?: Array<{
            type: string;
            text?: string;
            annotations?: Array<{
                type: string;
                url: string;
                title: string;
            }>;
        }>;
    }>;
}

export interface GeminiCompletion {
    candidates: {
        content: {
            parts: {
                text: string;
                functionCall?: GeminiToolCall
            }[]
        };
        groundingMetadata?: {
            groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
        };
    }[]
}

export interface AIResponseFormatSchema {
    type: 'object',
    properties: AIResponsePropertiesSchema;
    required?: string[]
}

export interface AIResponsePropertiesSchema {
    [key: string]: AIResponsePropertySchema
}

export interface AIResponsePropertySchema {
    type: 'array' | 'string' | 'number' | 'integer' | 'object' | 'boolean' | 'anyof',
    enum?: (string | number)[],
    format?: string,
    description?: string,
    maxLength?: number

    //for array types only
    items?: ChatGPTResponsePropertySchema; 
    minItems?: number;
    maxItems?: number;

    //for object types only
    properties?: AIResponsePropertiesSchema; 
    required?: string[];
}

export interface BedrockResponseFormatSchema extends AIResponseFormatSchema {
    $schema: 'https://json-schema.org/draft/2020-12/schema';
    description: string;
}

export interface ChatGPTTool {
    type: string;
    function: ChatGPTToolFunction;
}

export type GeminiTool = { functionDeclarations: ChatGPTToolFunction[] } | { google_search: Record<string, never> };

export interface ChatGPTToolFunction {
    name: string;
    description: string;
    parameters: ChatGPTToolParam
}

export interface ChatGPTToolParam {
    type: 'object',// | 'string' | 'number',
    properties: {
        [propName: string]: ChatGPTToolProperty | ChatGPTToolFunction
    },
    required: string[]
}

//enums are arrays not strings. string is overloaded by me to allow dynamic enumMaps
export interface ChatGPTToolProperty { type: 'string' | 'number' | 'array' | 'object', description: string, items?: { type: 'string' | 'number' | 'object', enum?: (string | number)[], properties?: { [key: string]: ChatGPTToolProperty } }, properties?: { [key: string]: ChatGPTToolProperty }, enum?: string | (string | number)[] };

export interface ChatGPTResponseFormat {
    type: 'json_schema',
    json_schema: {
        name: string;
        schema: ChatGPTResponseFormatSchema
        strict: boolean
    }
}

export interface ChatGPTResponseFormatSchema extends AIResponseFormatSchema {
    additionalProperties: boolean
}

export interface ChatGPTResponsePropertySchema extends AIResponsePropertySchema {
    enum?: any[],

    //for object types only
    additionalProperties?: boolean; 
}


export interface ChatGPTResponsePropertiesSchema {
    [key: string]: ChatGPTResponsePropertySchema
}

export enum AIMaxTokens {
    Minimum = 256,
    Default = 512,
    Maximum = 1024,
    Ultra = 2056,
    Mega = 4096
}

export interface AICompletionOptions { 
    maxTokens?: AIMaxTokens;
    temperature?: number; 
    model?: AIModel; 
    logResponse?: boolean; 
    responseFormat?: ChatGPTResponseFormat;
}

export class AIAgent {
    oid: string;
    email?: string;
    phone?: string;
    img?: string;
    url?: string;
    tags?: string[];
    metadata?: GenericMap<any>;

    @Virtual()
    public systemContext: AIContext[];

    private _conversation: AIConversation<any>;
    get conversation(): AIConversation<any> { return this._conversation; };

    embedding?: number[];

    constructor(public name: string, public systemMessage?: string, public responseFormat?: ChatGPTResponseFormat, oid?: string, public model?: AIModel) {
        this.oid = oid || Common.uniqueId();

        this._conversation = new AIConversation(this.oid, this.toSystemMessage(systemMessage));
    }

    setSystemMessage(systemMessage: string) {
        this.systemMessage = systemMessage;

        const sm = this._conversation.messages.find(m => m.role === 'system');
        if(sm) {
            sm.content = systemMessage;
        }
        else {
            this._conversation.messages.splice(0, 0, this.toSystemMessage(systemMessage));
        }
        
        this._conversation.messages.find(m => m.role === 'system').content = systemMessage;
    }

    private toSystemMessage(text: string): AIMessage<any> {
        return { role: 'system', content: text || '' };
    }

    setConversation<T>(conversation: AIConversation<T>) {
        this._conversation = AIConversation.from(conversation, this.oid);
    }

    formattedConversation() {
        return { ...this.conversation, messages: this.conversation.messages.filter(m => m.role !== 'system') }
    }

    addMessage(message: AIMessage<any>) {
        this._conversation.add(message);
    }

    addContext(context: AIContext) {
        if(!this.systemContext) {
            this.systemContext = [];
        }
        
        if(!context.oid) {
            context.oid = Common.uniqueId();
        }
        
        this.systemContext.push(context);
    }

    getContext() {
        return this.systemContext;
    }

    static from(agent: AIAgent) {
        const cls = new AIAgent(agent.name, agent.systemMessage);

        for(const key in agent) {
            if(key === 'conversation') {
                cls.setConversation(agent[key]);
            }
            else {
                cls[key] = agent[key];
            }
        }

        return cls;
    }
}

export class AIConversation<T> {
    oid: string;
    messages: AIMessage<T>[];
    messageIndex?: number;

    status?: AIConversationStatus;

    get agentId(): string {
        return this._agentId;
    }

    constructor(private _agentId: string, systemMessage: ChatGPTMessage) {
        this.oid = Common.uniqueId();
        this.messages = systemMessage ? [systemMessage] : [];
    }

    add(message: AIMessage<T>) {
        this.messages.push(message);
    }

    static from<T>(conversation: AIConversation<T>, agentId: string) {
        const cls = new AIConversation(agentId, null);

        for(const key in conversation) {
            if(key === 'agentId') {
                continue;
            }

            cls[key] = conversation[key];
        }

        return cls;
    }
}

export class AIConversationResponse<T> { 
    conversation: AIConversation<T>;
    data: T[]; 
    answer: string;
    actionRes?: { data: any[], messages: ChatGPTMessage[] };
}

export enum AIConversationStatus {
    WaitingOnUser = 0,
    InProgress = 1
} 

export interface AIContext {
    oid?: uniqueid;
    type: AIContextType;
    path?: string;
    name?: string;
    img?: string;
    function?: (data: AIConversation<any>) => Promise<string>;
    filter?: GenericMap<any>;
    content?: any;
    data?: GenericMap<any>;
    public?: boolean;
}

export interface AISharedContext extends AIContext {
    
}

export enum AIContextType {
    File = 'file',
    Web = 'web',
    Database = 'database',
    Text = 'text',
    Function = 'function',
    ShareRequest = 'share_request'
}

export var AIContextIconMap = {
    [AIContextType.File]: 'article',
    [AIContextType.Web]: 'language',
    [AIContextType.Database]: 'database',
    [AIContextType.Text]: 'text_fields',
    [AIContextType.Function]: 'function',
    [AIContextType.ShareRequest]: 'share'
}