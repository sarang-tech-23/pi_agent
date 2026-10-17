import type { ChatFunctionTool, ChatMessages } from "@openrouter/sdk/models";
import type { Message, ToolCall } from "../messages";
import type { LlmClient, LlmRequest, LlmTurn } from "./port";

/** Maps harness messages onto the SDK's message shape. */
function toSdkMessages(messages: Message[]): ChatMessages[] {
    return messages.map((m): ChatMessages => {
        switch (m.role) {
            case "system":
                return { role: "system", content: m.content };
            case "user":
                return { role: "user", content: m.content };
            case "assistant":
                return {
                    role: "assistant",
                    content: m.content,
                    ...(m.toolCalls?.length
                        ? {
                              toolCalls: m.toolCalls.map((c) => ({
                                  id: c.id,
                                  type: "function" as const,
                                  function: { name: c.name, arguments: c.arguments },
                              })),
                          }
                        : {}),
                };
            case "tool":
                return { role: "tool", toolCallId: m.toolCallId, content: m.content };
        }
    });
}

/** Normalises the SDK response into the harness's provider-neutral turn. */
function fromSdkResponse(res: any): LlmTurn {
    const message = res?.choices?.[0]?.message;
    const toolCalls: ToolCall[] = (message?.toolCalls ?? []).map((c: any) => ({
        id: c.id,
        name: c.function?.name,
        arguments: c.function?.arguments ?? "{}",
    }));
    return { content: message?.content ?? null, toolCalls };
}

export interface OpenRouterOptions {
    apiKey: string;
    model: string;
    /** per-request HTTP timeout, so a stalled provider cannot hang the harness */
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
    httpReferer?: string;
    appTitle?: string;
}

/**
 * Builds an LlmClient backed by OpenRouter. The SDK import and client are
 * created lazily so importing this module never requires credentials, and the
 * tool set arrives per request instead of being imported from the tools layer.
 */
export async function createOpenRouterClient(opts: OpenRouterOptions): Promise<LlmClient> {
    const { OpenRouter } = await import("@openrouter/sdk");
    const client = new OpenRouter({
        httpReferer: opts.httpReferer ?? "localhost",
        appTitle: opts.appTitle ?? "pi_agent",
        appCategories: "harness",
        apiKey: opts.apiKey,
    });

    return {
        async complete(request: LlmRequest): Promise<LlmTurn> {
            const result = await client.chat.send(
                {
                    chatRequest: {
                        stream: false,
                        model: opts.model,
                        messages: toSdkMessages(request.messages),
                        tools: request.tools as ChatFunctionTool[],
                        ...(opts.maxTokens != null ? { maxTokens: opts.maxTokens } : {}),
                        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
                    },
                },
                {
                    ...(opts.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
                    ...(request.signal ? { signal: request.signal } : {}),
                },
            );

            // openrouter.chat.send is typed as streaming or not; we asked for not
            if (Symbol.asyncIterator in (result as object)) {
                throw new Error("Expected a non-streaming response");
            }
            return fromSdkResponse(result);
        },
    };
}
