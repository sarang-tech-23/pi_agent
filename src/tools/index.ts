import { ToolRegistry } from "./registry";
import { readTool } from "./read";
import { bashTool } from "./bash";
import { writeTool } from "./write";
import { editTool } from "./edit";

/**
 * The tools the harness exposes. Adding a tool means adding one file exporting
 * a Tool and adding it here; there is no dispatch switch or schema list to
 * update, because each tool carries its own schema and policy.
 */
export const ALL_TOOLS = [readTool, bashTool, writeTool, editTool];

export function createRegistry(tools = ALL_TOOLS): ToolRegistry {
    return new ToolRegistry(tools);
}

export { ToolRegistry, runTool } from "./registry";
export type { Tool, ToolContext } from "./tool";
