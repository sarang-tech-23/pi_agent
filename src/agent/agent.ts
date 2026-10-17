import { llmCall } from "../provider/openrouter";
import type { ChatMessages } from "@openrouter/sdk/models";
import { runTool, setReadline, setMode } from "../tools/executor"
import { createInterface } from "node:readline/promises";

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

async function agent(messages: ChatMessages[], loopCnt = 100) {
    for (let turn = 0; turn < loopCnt; turn++) {
        const res = await llmCall(messages)
        const llmResp = res.choices[0]?.message;

        console.log("-> llm_tool_call_response__", llmResp?.toolCalls?.length)

        if (!llmResp?.toolCalls?.length) {
            // plain answer, record it once and stop
            messages.push({
                role: "assistant",
                content: llmResp?.content
            })
            console.log(" ######### Final Answer ######### \n ", llmResp?.content)
            return
        }

        // exactly one assistant message per turn, carrying the tool calls
        messages.push({
            role: "assistant",
            content: llmResp?.content ?? null,
            toolCalls: llmResp?.toolCalls,
        });

        for (const call of llmResp.toolCalls) {
            let toolResult: string
            try {
                const args = JSON.parse(call.function.arguments)
                toolResult = await runTool(call.function.name, args)
            } catch (err: any) {
                // a bad tool call must not leave a dangling toolCallId in the history
                toolResult = `Error: ${err.message}`
            }
            messages.push({
                role: "tool",
                toolCallId: call.id,
                content: toolResult,
            })
        }
    }
    console.log(`\n[stopped] hit the ${loopCnt} turn limit without a final answer.`)
}


async function main() {
    const messages: ChatMessages[] = [
        { role: "system", content: "you are an helpfull assitent" },
    ]

    // --manual / PI_AGENT_MODE=manual turns on the approval prompt in executor.ts.
    // default stays "auto" so the docker sandbox behaves as documented.
    const manual = process.argv.includes("--manual") || Bun.env.PI_AGENT_MODE === "manual"
    setMode(manual ? "manual" : "auto")

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    setReadline(rl)
    console.log(`pi_agent ready (mode: ${manual ? "manual" : "auto"}). type your query, "exit" or ctrl-d to quit.`)
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
