import { z } from "zod";
import { writeFile as wf, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tool } from "./tool";

const schema = z.object({
    filepath: z.string().describe("full path of file to write"),
    data: z.string().describe("text to write in file"),
});

export const writeTool: Tool<typeof schema> = {
    name: "writeFile",
    description: "writes to a new file, fails on already existing files",
    schema,
    // creating files needs approval in manual mode
    policy: () => "ask",
    async run({ filepath, data }) {
        try {
            await mkdir(dirname(filepath), { recursive: true });
            // the wx args throw error if the file already exists
            await wf(filepath, data, { encoding: "utf-8", flag: "wx" });
            return "SUCCESS";
        } catch (err: any) {
            if (err.code === "EEXIST") {
                return `Error: ${filepath} already exists. Use the edit tool to modify it.`;
            }
            return `Error writing ${filepath}: ${err.message}`;
        }
    },
};