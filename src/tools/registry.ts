import type { ChatFunctionTool } from "@openrouter/sdk/models";
import type { Tool, ToolContext } from "./tool";
import { toFunctionTool } from "./tool";

/**
 * Holds the available tools and replaces the two hand-maintained switches that
 * previously had to be kept in sync (one for approval policy, one for dispatch).
 */
export class ToolRegistry {
    private tools = new Map<string, Tool>();

    constructor(tools: Tool[] = []) {
        for (const t of tools) this.register(t);
    }

    register(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`duplicate tool name: ${tool.name}`);
        }
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    names(): string[] {
        return [...this.tools.keys()];
    }

    /** Tool definitions for the model, derived from each tool's zod schema. */
    definitions(): ChatFunctionTool[] {
        return [...this.tools.values()].map(toFunctionTool);
    }
}

export interface ToolOutcome {
    /** text handed back to the model */
    content: string;
    /** true when the tool itself reported a failure, for telemetry later */
    failed: boolean;
}

export interface RunOptions {
    ctx: ToolContext;
    /**
     * Called when a tool's policy is "ask". Returning false denies execution.
     * Omitted means auto-approve, matching the historical default.
     */
    confirm?: (name: string, args: unknown) => Promise<boolean>;
}

/**
 * Validates arguments, applies the approval policy, then runs the tool.
 * Never throws for expected failures: every outcome comes back as text so the
 * loop can always record a matching tool response and keep the history valid.
 */
export async function runTool(
    registry: ToolRegistry,
    name: string,
    rawArgs: string,
    opts: RunOptions,
): Promise<ToolOutcome> {
    const tool = registry.get(name);
    if (!tool) {
        return { content: `Error: unknown tool "${name}". Available: ${registry.names().join(", ")}`, failed: true };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawArgs);
    } catch (err) {
        return { content: `Error: arguments for "${name}" were not valid JSON: ${(err as Error).message}`, failed: true };
    }

    const validated = tool.schema.safeParse(parsed);
    if (!validated.success) {
        return {
            content: `Error: invalid arguments for "${name}". ${validated.error.issues
                .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; ")}`,
            failed: true,
        };
    }

    const args = validated.data as never;

    if (tool.policy(args) === "ask" && opts.confirm) {
        const approved = await opts.confirm(name, args);
        if (!approved) {
            return {
                content: "User denied this action. Do not retry it, ask the user what to do instead.",
                failed: false,
            };
        }
    }

    try {
        return { content: await tool.run(args, opts.ctx), failed: false };
    } catch (err) {
        return { content: `Error: ${name} failed: ${(err as Error).message}`, failed: true };
    }
}
