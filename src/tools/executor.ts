
import { readFiles } from "./read";


export async function runTool(name: string, args: any): Promise<string> {
  switch (name) {
    case "readFiles":
      return await readFiles(args.filename);
    default:
      return `Error: unknown tool "${name}"`;
  }
}
