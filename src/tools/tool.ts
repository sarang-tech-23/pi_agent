import { z } from "zod";
import type { ChatFunctionTool } from "@openrouter/sdk/models";

/**
 * A single tool, self-describing. Schema, approval policy and implementation
 * live together so they cannot drift apart: adding a tool means adding one file
 * and registering it, with no edits to a dispatch switch or a config list.
 */
export interface Tool<S extends z.ZodType = z.ZodType> {
    /** name the model calls */
    name: string;
    /** shown to the model */
    description: string;
    /** validates incoming arguments before the implementation sees them */
    schema: S;
    /**
     * Approval policy. "allow" runs immediately, "ask" defers to the UI layer
     * when the harness is in manual mode.
     */
    policy: (args: z.infer<S>) => "allow" | "ask";
    /** the implementation. never throws for expected failures, returns text */
    run: (args: z.infer<S>, ctx: ToolContext) => Promise<string>;
}

/** Ambient capabilities a tool may use, injected rather than imported. */
export interface ToolContext {
    /** working directory the tool should operate in */
    cwd: string;
}

/**
 * Derives the OpenAI/OpenRouter tool definition from a Tool, so the JSON schema
 * the model sees is generated from the same zod schema used to validate the
 * arguments. No hand-written duplicate to drift out of sync.
 */
export function toFunctionTool(tool: Tool): ChatFunctionTool {
    const jsonSchema = z.toJSONSchema(tool.schema as z.ZodType) as Record<string, unknown>;
    // the SDK does not need the draft $schema marker, and some providers reject it
    delete jsonSchema["$schema"];

    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: jsonSchema,
        },
    } as ChatFunctionTool;
}
