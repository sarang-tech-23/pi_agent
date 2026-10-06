import type { ChatFunctionTool } from "@openrouter/sdk/models";
import { readFiles } from "./read";
import { properties } from "zod";



export const CUSTOM_TOOLS: ChatFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "readFiles",
            description: "read the text inside the files",
            parameters: {
                type: "object",
                properties: {
                    filename: {type: "string", description: "full path of the file"}
                },
                required: ["filename"]
            }
        }
    }
] 