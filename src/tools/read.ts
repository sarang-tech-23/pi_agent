import { readFile } from "node:fs/promises";


export async function readFiles(filename: string) {
    try {
        return await readFile(filename, "utf-8")
    } catch (err) {
        return `error in reading file ${filename} :${err}`
    }
}