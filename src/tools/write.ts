import { writeFile as wf, mkdir } from "node:fs/promises";
import { dirname } from "node:path"

export async function writeFile(filepath: string, data: string) {
    try {
        await mkdir(dirname(filepath), { recursive: true })
        // the wx args throw error if the file already exists
        await wf(filepath, data, { encoding: "utf-8", flag: "wx" })
        return "SUCCESS"
    } catch (err: any) {
        if (err.code === "EEXIST") {
            return `Error: ${filepath} already exists. Use the edit tool to modify it.`;
        }
        return `Error writing ${filepath}: ${err.message}`;
    }
}   