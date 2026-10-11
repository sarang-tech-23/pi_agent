import type { ChatFunctionTool } from "@openrouter/sdk/models";

export const CUSTOM_TOOLS: ChatFunctionTool[] = [
    {
        type: "function",
        function: {
            name: "readFiles",
            description: "reads the text from existing files",
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
    },
    {
        type: "function",
        function: {
            name: "writeFile",
            description: "writes to a new file, fails on already existing files",
            parameters: {
                type: "object",
                properties: {
                    filepath: {type: "string", description: "full path of file to write"},
                    data: {type: "string", description: "text to write in file"}
                },
                required: ["filepath", "data"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "editFile",
            description: "edits and already existing file",
            parameters: {
                type: "object",
                properties: {
                    filepath: {type: "string", description: "full path of file to write"},
                    oldText: {type: "string", description: "old part of the text which needs to be replaced"},
                    newText: {type: "string", description: "new text to overwriote in place of old part of the text"},
                },
                required: ["filepath", "oldText", "newText"]
            }
        }
    }
] 