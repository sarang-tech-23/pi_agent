import type { ChatFunctionTool } from "@openrouter/sdk/models";
import type { Message, ToolCall } from "../messages";

/** One assistant turn, normalised away from any provider's response envelope. */
export interface LlmTurn {
    content: string | null;
    toolCalls: ToolCall[];
}

export interface LlmRequest {
    messages: Message[];
    tools: ChatFunctionTool[];
    signal?: AbortSignal;
}

/**
 * The seam between the agent loop and any model provider. The loop depends on
 * this interface only, so it can be driven by a stub in tests without a network
 * call or an API key.
 */
export interface LlmClient {
    complete(request: LlmRequest): Promise<LlmTurn>;
}
