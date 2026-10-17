import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import type { Tool } from "./tool";

const schema = z.object({
  filepath: z.string().describe("full path of file to write"),
  oldText: z.string().describe("old part of the text which needs to be replaced"),
  newText: z.string().describe("new text to overwrite in place of old part of the text"),
});

export async function editFile(filepath: string, oldText: string, newText: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err: any) {
    return `Error reading ${filepath}: ${err.message}`;
  }

  const count = content.split(oldText).length - 1;
  if (count === 0) {
    return `Error: oldText not found in ${filepath}. Re-read the file and copy the text exactly, including whitespace.`;
  }
  if (count > 1) {
    return `Error: oldText matches ${count} places in ${filepath}. Include more surrounding lines so it is unique.`;
  }

  // the replacer function keeps $& and friends in newText literal
  const updated = content.replace(oldText, () => newText);
  try {
    await writeFile(filepath, updated, "utf-8");
  } catch (err: any) {
    return `Error writing ${filepath}: ${err.message}`;
  }
  return `Successfully edited ${filepath}`;
}

export const editTool: Tool<typeof schema> = {
  name: "editFile",
  description: "edits an already existing file",
  schema,
  // modifying files needs approval in manual mode
  policy: () => "ask",
  run: ({ filepath, oldText, newText }) => editFile(filepath, oldText, newText),
};