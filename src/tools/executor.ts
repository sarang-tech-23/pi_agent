
import { readFile } from "./read";
import { writeFile } from "./write"
import { editFile } from "./edit"
import { bash } from "./bash"


export async function runTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "readFiles":
      return await readFile(args.filename);
    case "writeFiles":
      return await writeFile(args.filepath, args.data)
    case "editFile":
      return await editFile(args.filepath, args.oldText, args.newText)
    case "bash":
      return await bash(args.command)
    default:
      return `Error: unknown tool "${name}"`;
  }
}

// my next goal is to integrate read, write, edit, and bash command
// so that the agent have flexibiilty to interact with the system and its binaries
// make sure the mutating tool calls are safe for the system