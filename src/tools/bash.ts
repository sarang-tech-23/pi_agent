
import { z } from "zod";
import type { Tool } from "./tool";

const schema = z.object({
    command: z.string().describe("give command in string to be run like bash -c command"),
});

const READ_ONLY = new Set(["ls", "cat", "pwd", "head", "tail", "wc", "grep", "rg", "echo", "which", "whoami"]);
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show"]);

/**
 * Classifies a command as safe to run without asking. This checks the program
 * name only, so a read-only binary aimed at a sensitive path still passes;
 * it is a convenience, not a security boundary.
 */
export function isReadOnlyCommand(command: string): boolean {
    // 1. reject anything that can chain, redirect, or substitute
    if (/[;&|<>`$(){}\n\\]/.test(command)) return false;

    // 2. split into words and check the program name
    const [prog, sub] = command.trim().split(/\s+/);
    if (!prog) return false;
    if (prog === "git") return READ_ONLY_GIT.has(sub ?? "");
    return READ_ONLY.has(prog);
}

export async function runBash(command: string): Promise<string> {
    const proc = Bun.spawn(["bash", "-c", command], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    return `exit=${code}\n${out}${err ? "\n[stderr]\n" + err : ""}`;
}

export const bashTool: Tool<typeof schema> = {
    name: "bash",
    description: "run the bash commands",
    schema,
    policy: ({ command }) => (isReadOnlyCommand(command) ? "allow" : "ask"),
    run: ({ command }) => runBash(command),
};