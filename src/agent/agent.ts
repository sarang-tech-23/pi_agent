import { llmCall } from "../provider/openrouter";
import type { ChatMessages } from "@openrouter/sdk/models";
import { runTool } from "../tools/executor"
import { createInterface } from "node:readline/promises";

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

async function agent(messages: ChatMessages[], loopCnt = 10) {
    while (loopCnt--) {
        const res = await llmCall(messages)
        const llmResp = res.choices[0]?.message;

        console.log("-> llm_tool_call_response__", llmResp?.toolCalls?.length)

        if (llmResp?.toolCalls?.length) {
            for (const call of llmResp.toolCalls) {
                const args = JSON.parse(call.function.arguments)
                let toolResult = await runTool(call.function.name, args)
                // console.log("=>> tool result: ", toolResult)
                messages.push({
                    role: "tool",
                    toolCallId: call.id,
                    content: toolResult,
                })
            }
        }
        else {
            console.log("Final Answer: ", llmResp?.content)
            return
        }
    }
}


async function main() {
    const messages: ChatMessages[] = [
        { role: "system", content: "you are an helpfull assitent" },
    ]

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    console.log('pi_agent ready. type your query, "exit" or ctrl-d to quit.')
    rl.setPrompt("> ")
    rl.prompt()

    // the history stays in `messages`, so follow-up questions keep their context
    for await (const line of rl) {
        const query = line.trim()
        if (query === "exit") break
        if (query) {
            messages.push({ role: "user", content: query })
            try {
                await agent(messages)
            } catch (err: any) {
                console.log(`error: ${err.message}`)
            }
        }
        rl.prompt()
    }
    rl.close()
}

main()