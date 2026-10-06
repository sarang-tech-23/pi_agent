import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages, ChatResult } from "@openrouter/sdk/models";
import { CUSTOM_TOOLS } from "../tools/config";

const openRouter = new OpenRouter({
    httpReferer: "localhost",
    appTitle: "pi_agent",
    appCategories: "harness",
    apiKey: Bun.env.OPENROUTER_API_KEY,
});

export async function llmCall(messages: ChatMessages[]): Promise<ChatResult> {
    const result = await openRouter.chat.send({
        chatRequest: {
            stream: false,
            model: "deepseek/deepseek-v4.1-flash",
            messages,
            tools: CUSTOM_TOOLS
        },
    });

    // to supress type warning, openrouter.chat.send return 2 types of responses, streaming 
    // and not streaming, we want to keep the resutl scoped to just non streaming response
    if (Symbol.asyncIterator in result) {
        throw new Error("Expected a non-streaming response");
    }

    // console.log("=>> result", JSON.stringify(result))
    return result;
}
