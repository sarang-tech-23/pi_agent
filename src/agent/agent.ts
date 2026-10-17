import type { LlmClient } from "../provider/port";
import type { Message } from "../messages";
import type { ToolRegistry } from "../tools/registry";
import { runTool } from "../tools/registry";

/** Everything the harness needs from the outside world, injected. */
export interface Ui {
    say(text: string): void;
    /** asks the user to approve a tool call. omitted means auto-approve. */
    confirm?(name: string, args: unknown): Promise<boolean>;
}

export interface AgentDeps {
    llm: LlmClient;
    tools: ToolRegistry;
    ui: Ui;
    cwd: string;
}

export interface AgentOptions {
    maxTurns?: number;
    signal?: AbortSignal;
}

export interface TurnResult {
    /** the assistant's final text, if it produced one */
    content: string | null;
    /** how many model round-trips were used */
    turns: number;
    /** true when the loop stopped because it hit maxTurns */
    exhausted: boolean;
}

/**
 * Runs the tool-calling loop until the model answers without requesting a tool,
 * or the turn budget is spent. Depends only on the injected ports, so it can be
 * driven by a stub LlmClient and a scripted Ui with no network or terminal.
 *
 * `messages` is mutated in place so callers keep conversation history across
 * queries.
 */
export async function runAgent(
    deps: AgentDeps,
    messages: Message[],
    opts: AgentOptions = {},
): Promise<TurnResult> {
    const maxTurns = opts.maxTurns ?? 25;

    for (let turn = 0; turn < maxTurns; turn++) {
        const assistant = await deps.llm.complete({
            messages,
            tools: deps.tools.definitions(),
            signal: opts.signal,
        });

        // no tool calls means we are done; record the answer exactly once
        if (!assistant.toolCalls.length) {
            messages.push({ role: "assistant", content: assistant.content });
            return { content: assistant.content, turns: turn + 1, exhausted: false };
        }

        // one assistant message per turn, carrying the calls it requested
        messages.push({
            role: "assistant",
            content: assistant.content,
            toolCalls: assistant.toolCalls,
        });

        for (const call of assistant.toolCalls) {
            const outcome = await runTool(deps.tools, call.name, call.arguments, {
                ctx: { cwd: deps.cwd },
                confirm: deps.ui.confirm?.bind(deps.ui),
            });
            // every tool call gets a response, so the history stays valid even
            // when the arguments were malformed or the user denied the action
            messages.push({
                role: "tool",
                toolCallId: call.id,
                content: outcome.content,
            });
        }
    }

    return { content: null, turns: maxTurns, exhausted: true };
}
