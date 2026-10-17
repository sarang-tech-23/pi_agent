
import type { Interface } from "node:readline/promises";
import { readFile } from "./read";
import { writeFile } from "./write"
import { editFile } from "./edit"
import { bash } from "./bash"


type Mode = "auto" | "manual"
let mode: Mode = "auto"

export function setMode(m: Mode) {
  mode = m
}

// the same readline that agent.ts uses, a second one on stdin would clash with it
let rl: Interface | undefined

export function setReadline(r: Interface) {
  rl = r
}

type Decision = "allow" | "ask"

const READ_ONLY = new Set(["ls", "cat", "pwd", "head", "tail", "wc", "grep", "rg", "echo", "which", "whoami"]);
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show"]);

export function isReadOnlyCommand(command: string): boolean {
  // 1. reject anything that can chain, redirect, or substitute
  if (/[;&|<>`$(){}\n\\]/.test(command)) return false;

  // 2. split into words and check the program name
  const [prog, sub] = command.trim().split(/\s+/);
  if (!prog) return false;
  if (prog === "git") return READ_ONLY_GIT.has(sub ?? "");
  return READ_ONLY.has(prog);
}

function decide(toolName: string, args: any): Decision {
  switch (toolName) {
    case "readFiles":
      return "allow"
    case "writeFile":
      return "ask"
    case "editFile":
      return "ask"
    case "bash":
      return isReadOnlyCommand(args.command) ? "allow" : "ask";
    default:
      return "ask"
  }
}

// asks the user in the terminal, anything other than "y" means no
async function confirm(toolName: string, args: any): Promise<boolean> {
  // no way to ask, so do not run it
  if (!rl) return false
  console.log(`\n[approval needed] ${toolName}`)
  console.log(JSON.stringify(args, null, 2))
  const answer = await rl.question("run this? (y/N) ")
  return answer.trim().toLowerCase() === "y"
}

async function execute(name: string, args: any): Promise<string> {
  switch (name) {
    case "readFiles":
      return await readFile(args.filename);
    case "writeFile":
      return await writeFile(args.filepath, args.data)
    case "editFile":
      return await editFile(args.filepath, args.oldText, args.newText)
    case "bash":
      return await bash(args.command)
    default:
      return `Error: unknown tool "${name}"`;
  }
}

export async function runTool(name: string, args: any): Promise<string> {
  if (mode === "manual" && decide(name, args) === "ask") {
    const approved = await confirm(name, args)
    console.log(" ->> toolcall_approval: ", name, mode, args, approved);
    if (!approved) {
      return "User denied this action. Do not retry it, ask the user what to do instead."
    }
  }
  return await execute(name, args)
}
