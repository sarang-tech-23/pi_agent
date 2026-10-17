import { test, expect, describe } from "bun:test";
import { ToolRegistry, runTool } from "../tools/registry";
import type { Tool } from "../tools/tool";
import { z } from "zod";

const ctx = { cwd: "/tmp" };

/** A throwaway tool used to exercise the registry in isolation. */
function makeTool(over: Partial<Tool<z.ZodObject<any>>> = {}): Tool<z.ZodObject<any>> {
    const schema = z.object({ value: z.string() });
    return {
        name: "probe",
        description: "probe",
        schema,
        policy: () => "allow",
        run: async ({ value }) => `ran:${value}`,
        ...over,
    } as Tool<z.ZodObject<any>>;
}

describe("registry", () => {
    test("rejects duplicate tool names", () => {
        const r = new ToolRegistry([makeTool()]);
        expect(() => r.register(makeTool())).toThrow(/duplicate tool name/);
    });

    test("derives model-facing definitions from the zod schema", () => {
        const r = new ToolRegistry([makeTool()]);
        const def = r.definitions()[0];
        expect(def).toBeDefined();
        expect(def!.type).toBe("function");
        expect((def as any).function.name).toBe("probe");
        // generated from the schema, so the two cannot drift
        expect((def as any).function.parameters.properties.value.type).toBe("string");
        expect((def as any).function.parameters.required).toEqual(["value"]);
        // draft marker stripped for provider compatibility
        expect((def as any).function.parameters.$schema).toBeUndefined();
    });
});

describe("runTool", () => {
    test("runs a tool and returns its output", async () => {
        const r = new ToolRegistry([makeTool()]);
        const out = await runTool(r, "probe", '{"value":"a"}', { ctx });
        expect(out.content).toBe("ran:a");
        expect(out.failed).toBe(false);
    });

    test("unknown tool is reported, not thrown", async () => {
        const r = new ToolRegistry([makeTool()]);
        const out = await runTool(r, "nope", "{}", { ctx });
        expect(out.failed).toBe(true);
        expect(out.content).toContain("unknown tool");
        expect(out.content).toContain("probe"); // lists what is available
    });

    test("malformed JSON is reported, not thrown", async () => {
        const r = new ToolRegistry([makeTool()]);
        const out = await runTool(r, "probe", '{"value":', { ctx });
        expect(out.failed).toBe(true);
        expect(out.content).toContain("not valid JSON");
    });

    test("invalid arguments are caught by the schema before the tool runs", async () => {
        let ran = false;
        const r = new ToolRegistry([makeTool({ run: async () => ((ran = true), "x") })]);
        const out = await runTool(r, "probe", '{"value":42}', { ctx });
        expect(ran).toBe(false); // never reached the implementation
        expect(out.failed).toBe(true);
        expect(out.content).toContain("invalid arguments");
    });
});

describe("approval policy", () => {
    const askTool = makeTool({ name: "risky", policy: () => "ask" });
    const okTool = makeTool({ name: "safe", policy: () => "allow" });

    test("policy ask consults confirm", async () => {
        const r = new ToolRegistry([askTool]);
        let asked = "";
        const out = await runTool(r, "risky", '{"value":"a"}', {
            ctx,
            confirm: async (name) => ((asked = name), true),
        });
        expect(asked).toBe("risky");
        expect(out.content).toBe("ran:a");
    });

    test("a denied call does not run the tool", async () => {
        let ran = false;
        const r = new ToolRegistry([makeTool({ name: "risky", policy: () => "ask", run: async () => ((ran = true), "x") })]);
        const out = await runTool(r, "risky", '{"value":"a"}', { ctx, confirm: async () => false });
        expect(ran).toBe(false);
        expect(out.content).toContain("denied");
    });

    test("policy allow never prompts", async () => {
        const r = new ToolRegistry([okTool]);
        let called = false;
        const out = await runTool(r, "safe", '{"value":"a"}', {
            ctx,
            confirm: async () => ((called = true), false),
        });
        expect(called).toBe(false);
        expect(out.content).toBe("ran:a");
    });

    test("no confirm handler means auto-approve", async () => {
        const r = new ToolRegistry([askTool]);
        const out = await runTool(r, "risky", '{"value":"a"}', { ctx });
        expect(out.content).toBe("ran:a");
    });
});
