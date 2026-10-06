import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages } from "@openrouter/sdk/models";
import { CUSTOM_TOOLS } from "../tools/config";

const openRouter = new OpenRouter({
    httpReferer: "localhost",
    appTitle: "pi_agent",
    appCategories: "harness",
    apiKey: Bun.env.OPENROUTER_API_KEY,
});

export async function llmCall(messages: ChatMessages[]) {
    const result = await openRouter.chat.send({
        chatRequest: {
            stream: false,
            model: "deepseek/deepseek-v4.1-flash",
            messages,
            tools: CUSTOM_TOOLS
        },
    });

    // console.log("=>> result", JSON.stringify(result))
    return result;
}
