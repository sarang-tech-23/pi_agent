import { llmCall } from "../provider/openrouter";
import type { ChatMessages } from "@openrouter/sdk/models";

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

async function main() {
    
    let messages: ChatMessages[] = [
        {role: "system", content: "you are an helpfull assitent"},
        {role: "user", content: "This file contain the cost i incured for a single llm call, can you please read and tell me whats the total amount, here is the full path to file /Users/spatil/Documents/sp/serprj/pi_agent/resources/llm_output.json"}
    ]
    const res = await llmCall(messages)
    console.log(JSON.stringify(res))
}

main()