import { readFile, writeFile } from "node:fs/promises";

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

  const updated = content.replace(oldText, () => newText);
  try {
    await writeFile(filepath, updated, "utf-8");
  } catch (err: any) {
    return `Error writing ${filepath}: ${err.message}`;
  }
  return `Successfully edited ${filepath}`;
}