import { llmCall } from "../provider/openrouter";
import type { ChatMessages } from "@openrouter/sdk/models";
import { runTool } from "../tools/executor"
export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

async function agent(userQuery: string, loopCnt = 5) {
    let messages: ChatMessages[] = [
        { role: "system", content: "you are an helpfull assitent" },
        { role: "user", content: userQuery }
    ]
    while (loopCnt--) {
        const res = await llmCall(messages)
        const message = res.choices[0]?.message;

        console.log("-> llm_tool_call_response__", message?.toolCalls?.length)

        if (message?.toolCalls?.length) {
            for (const call of message.toolCalls) {
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
            console.log("Final Answer: ", message?.content)
        }
    }
}



const userQuery = "can you please list all the files in current working directory ?"
agent(userQuery)