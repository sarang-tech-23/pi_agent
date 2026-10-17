import { test, expect, describe } from "bun:test";
import { runAgent, type AgentDeps, type Ui } from "../agent/agent";
import type { LlmClient, LlmRequest, LlmTurn } from "../provider/port";
import type { Message } from "../messages";
import { ToolRegistry } from "../tools/registry";
import type { Tool } from "../tools/tool";
import { z } from "zod";

/**
 * A scripted LlmClient. This is the payoff of the port: the loop can be driven
 * through any sequence of turns with no network call and no API key.
 */
function stubLlm(turns: LlmTurn[]): LlmClient & { seen: LlmRequest[] } {
    let i = 0;
    const seen: LlmRequest[] = [];
    return {
        seen,
        async complete(req) {
            seen.push(structuredClone(req));
            const t = turns[Math.min(i, turns.length - 1)] ?? turns[turns.length - 1];
            i++;
            if (!t) throw new Error("stubLlm: no scripted turn available");
            return t;
        },
    };
}

function stubUi(answers: boolean[] = []): Ui & { said: string[] } {
    const said: string[] = [];
    let i = 0;
    return {
        said,
        say: (t) => said.push(t),
        confirm: async () => answers[Math.min(i++, answers.length - 1)] ?? false,
    };
}

const echo: Tool<z.ZodObject<any>> = {
    name: "echo",
    description: "echo",
    schema: z.object({ text: z.string() }),
    policy: () => "allow",
    run: async ({ text }) => `echoed:${text}`,
};

function deps(over: Partial<AgentDeps> = {}): AgentDeps {
    return {
        llm: stubLlm([{ content: "hi", toolCalls: [] }]),
        tools: new ToolRegistry([echo]),
        ui: stubUi(),
        cwd: "/tmp",
        ...over,
    };
}

const call = (id: string, name: string, args: unknown) => ({
    id,
    name,
    arguments: JSON.stringify(args),
});

describe("runAgent", () => {
    test("returns the final answer when no tool is requested", async () => {
        const messages: Message[] = [{ role: "user", content: "hello" }];
        const res = await runAgent(deps(), messages);
        expect(res.content).toBe("hi");
        expect(res.turns).toBe(1);
        expect(res.exhausted).toBe(false);
    });

    test("executes a tool call and feeds the result back", async () => {
        const llm = stubLlm([
            { content: null, toolCalls: [call("c1", "echo", { text: "x" })] },
            { content: "done", toolCalls: [] },
        ]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        const res = await runAgent(deps({ llm }), messages);

        expect(res.content).toBe("done");
        expect(res.turns).toBe(2);
        const toolMsg = messages.find((m) => m.role === "tool") as any;
        expect(toolMsg.content).toBe("echoed:x");
        expect(toolMsg.toolCallId).toBe("c1");
    });

    test("records exactly one assistant message per turn", async () => {
        // regression: the loop used to push the assistant message twice
        const llm = stubLlm([
            { content: "thinking", toolCalls: [call("c1", "echo", { text: "x" })] },
            { content: "done", toolCalls: [] },
        ]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        await runAgent(deps({ llm }), messages);

        const assistants = messages.filter((m) => m.role === "assistant");
        expect(assistants).toHaveLength(2);
        // the first carries the tool calls, and nothing is duplicated
        expect((assistants[0] as any).toolCalls).toHaveLength(1);
        expect((assistants[0] as any).content).toBe("thinking");
    });

    test("every tool call gets a matching response, even with bad arguments", async () => {
        const llm = stubLlm([
            { content: null, toolCalls: [{ id: "bad", name: "echo", arguments: "{oops" }] },
            { content: "recovered", toolCalls: [] },
        ]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        const res = await runAgent(deps({ llm }), messages);

        expect(res.content).toBe("recovered");
        const ids = messages
            .flatMap((m: any) => m.toolCalls ?? [])
            .map((c: any) => c.id);
        const answered = messages.filter((m) => m.role === "tool").map((m: any) => m.toolCallId);
        expect(answered).toEqual(ids); // no dangling call
    });

    test("handles several tool calls in one turn", async () => {
        const llm = stubLlm([
            { content: null, toolCalls: [call("a", "echo", { text: "1" }), call("b", "echo", { text: "2" })] },
            { content: "done", toolCalls: [] },
        ]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        await runAgent(deps({ llm }), messages);
        const tools = messages.filter((m) => m.role === "tool") as any[];
        expect(tools.map((t) => t.content)).toEqual(["echoed:1", "echoed:2"]);
    });

    test("denied tool call tells the model not to retry", async () => {
        const askTool: Tool<any> = { ...echo, name: "risky", policy: () => "ask" };
        const llm = stubLlm([
            { content: null, toolCalls: [call("c1", "risky", { text: "x" })] },
            { content: "ok", toolCalls: [] },
        ]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        await runAgent(deps({ llm, tools: new ToolRegistry([askTool]), ui: stubUi([false]) }), messages);
        const toolMsg = messages.find((m) => m.role === "tool") as any;
        expect(toolMsg.content).toContain("denied");
    });

    test("reports exhaustion instead of looping forever", async () => {
        const llm = stubLlm([{ content: null, toolCalls: [call("c", "echo", { text: "x" })] }]);
        const messages: Message[] = [{ role: "user", content: "go" }];
        const res = await runAgent(deps({ llm }), messages, { maxTurns: 3 });
        expect(res.exhausted).toBe(true);
        expect(res.turns).toBe(3);
        expect(res.content).toBeNull();
    });

    test("passes registered tools to the model each turn", async () => {
        const llm = stubLlm([{ content: "hi", toolCalls: [] }]);
        await runAgent(deps({ llm }), [{ role: "user", content: "x" }]);
        expect(llm.seen[0]!.tools).toHaveLength(1);
        expect((llm.seen[0]!.tools[0] as any).function.name).toBe("echo");
    });

    test("propagates an aborted signal rather than swallowing it", async () => {
        const ac = new AbortController();
        const llm: LlmClient = {
            complete: async () => {
                ac.abort();
                throw new Error("RequestAbortedError");
            },
        };
        await expect(
            runAgent(deps({ llm }), [{ role: "user", content: "x" }], { signal: ac.signal }),
        ).rejects.toThrow(/abort/i);
    });
});
