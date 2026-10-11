import { readFile as rf } from "node:fs/promises";


export async function readFile(filename: string) {
    try {
        return await rf(filename, "utf-8")
    } catch (err) {
        return `error in reading file ${filename} :${err}`
    }
}