import { InjectionToken } from "injection-js";
import { AIConversation } from "../../../model/ai.model";
import { ApiResponse } from "../base.service";
import { AICompletionOptions, AIMessage, ChatGPTTool, AIToolChoice } from "../../../model/ai.model";
import { authid } from "../../../model/id.model";

export const AIServiceToken = new InjectionToken<IAIService>('IAIService');

export interface IAIService {
    models: string[];

    getTextCompletions(messages: AIMessage<any>[], options: AICompletionOptions, authId: authid): Promise<ApiResponse<any[]>>;
    
    getFunctionCall(messages: AIMessage<any>[], tools: ChatGPTTool[], toolChoice: AIToolChoice, options: AICompletionOptions, authId: authid);

    executeConversation<T>(conversation: AIConversation<T>, options: AICompletionOptions, authId: authid): Promise<AIMessage<T>>;

    executeFunctionCall<T>(conversation: AIConversation<T>, tools: ChatGPTTool[], toolChoice: AIToolChoice, options: AICompletionOptions, authId: authid): Promise<AIMessage<T>>;
}