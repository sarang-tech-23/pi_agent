import { z } from "zod";
import { readFile as rf } from "node:fs/promises";
import type { Tool } from "./tool";

const schema = z.object({
    filename: z.string().describe("full path of the file"),
});

export const readTool: Tool<typeof schema> = {
    name: "readFiles",
    description: "reads the text from existing files",
    schema,
    // reading never mutates anything
    policy: () => "allow",
    async run({ filename }) {
        try {
            return await rf(filename, "utf-8");
        } catch (err) {
            return `error in reading file ${filename} :${err}`;
        }
    },
};