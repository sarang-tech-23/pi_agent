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
    },
    {
        type: "function",
        function: {
            name: "bash",
            description: "run the bash commands",
            parameters: {
                type: "object",
                properties: {
                    command: {type: "string", description: "give command in string to be run like bash -c command"}
                },
                required: ["command"]
            }
        }
    }
] 