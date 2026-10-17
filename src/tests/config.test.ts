import { test, expect, describe } from "bun:test";
import { ConfigError, loadConfig } from "../config";

const base = { OPENROUTER_API_KEY: "k" };

describe("loadConfig", () => {
    test("applies sensible defaults", () => {
        const c = loadConfig([], base);
        expect(c.model).toBe("deepseek/deepseek-v4.1-flash");
        expect(c.mode).toBe("auto");
        expect(c.maxTurns).toBe(25);
        expect(c.timeoutMs).toBe(120_000);
    });

    test("requires an api key", () => {
        expect(() => loadConfig([], {})).toThrow(ConfigError);
        expect(() => loadConfig([], {})).toThrow(/OPENROUTER_API_KEY/);
    });

    test("--manual beats the environment", () => {
        expect(loadConfig(["--manual"], base).mode).toBe("manual");
        expect(loadConfig(["--auto"], { ...base, PI_AGENT_MODE: "manual" }).mode).toBe("auto");
    });

    test("reads PI_AGENT_MODE", () => {
        expect(loadConfig([], { ...base, PI_AGENT_MODE: "manual" }).mode).toBe("manual");
    });

    test("rejects a nonsense mode rather than silently defaulting", () => {
        expect(() => loadConfig([], { ...base, PI_AGENT_MODE: "wat" })).toThrow(/auto.*manual/);
    });

    test("model is configurable, so swapping does not need a code change", () => {
        expect(loadConfig([], { ...base, PI_AGENT_MODEL: "x/y" }).model).toBe("x/y");
        expect(loadConfig(["--model", "a/b"], base).model).toBe("a/b");
    });

    test("numeric flags and env are parsed", () => {
        expect(loadConfig(["--max-turns", "5"], base).maxTurns).toBe(5);
        expect(loadConfig([], { ...base, PI_AGENT_MAX_TURNS: "7" }).maxTurns).toBe(7);
        expect(loadConfig([], { ...base, PI_AGENT_MAX_TOKENS: "100" }).maxTokens).toBe(100);
        expect(loadConfig([], { ...base, PI_AGENT_TEMPERATURE: "0.2" }).temperature).toBeCloseTo(0.2);
    });

    test("rejects invalid numbers instead of producing NaN", () => {
        expect(() => loadConfig(["--max-turns", "abc"], base)).toThrow(ConfigError);
        expect(() => loadConfig(["--max-turns", "0"], base)).toThrow(/positive integer/);
        expect(() => loadConfig(["--max-turns", "-2"], base)).toThrow(/positive integer/);
        expect(() => loadConfig([], { ...base, PI_AGENT_TEMPERATURE: "hot" })).toThrow(/must be a number/);
    });

    test("a flag without a value is an error, not a silent default", () => {
        expect(() => loadConfig(["--model"], base)).toThrow(/requires a value/);
        expect(() => loadConfig(["--model", "--manual"], base)).toThrow(/requires a value/);
    });
});
