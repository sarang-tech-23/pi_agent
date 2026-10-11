
import { readFiles } from "./read";
import { bash } from "./bash"


export async function runTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "readFiles":
      return await readFiles(args.filename);
    case "bash":
      return await bash(args.command)
    default:
      return `Error: unknown tool "${name}"`;
  }
}
