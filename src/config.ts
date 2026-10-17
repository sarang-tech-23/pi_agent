/**
 * Harness configuration. Everything tunable is data read from the environment,
 * so changing the model or limits does not require editing code. Precedence is
 * CLI flag, then environment variable, then default.
 */

export type Mode = "auto" | "manual";

export interface Config {
    apiKey: string;
    model: string;
    mode: Mode;
    maxTurns: number;
    timeoutMs: number;
    maxTokens?: number;
    temperature?: number;
    cwd: string;
}

export class ConfigError extends Error {}

const DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";

function intFrom(value: string | undefined, fallback: number, name: string): number {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        throw new ConfigError(`${name} must be a positive integer, got ${JSON.stringify(value)}`);
    }
    return n;
}

function floatFrom(value: string | undefined, name: string): number | undefined {
    if (value == null || value === "") return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new ConfigError(`${name} must be a number, got ${JSON.stringify(value)}`);
    }
    return n;
}

export function loadConfig(
    argv: string[] = process.argv,
    env: Record<string, string | undefined> = Bun.env as any,
): Config {
    const flag = (name: string): string | undefined => {
        const i = argv.indexOf(name);
        if (i === -1) return undefined;
        const v = argv[i + 1];
        if (v == null || v.startsWith("--")) {
            throw new ConfigError(`${name} requires a value`);
        }
        return v;
    };

    // --manual / --auto, or PI_AGENT_MODE
    const mode: Mode = argv.includes("--manual")
        ? "manual"
        : argv.includes("--auto")
          ? "auto"
          : env.PI_AGENT_MODE === "manual"
            ? "manual"
            : "auto";

    if (env.PI_AGENT_MODE && env.PI_AGENT_MODE !== "manual" && env.PI_AGENT_MODE !== "auto") {
        throw new ConfigError(`PI_AGENT_MODE must be "auto" or "manual", got ${JSON.stringify(env.PI_AGENT_MODE)}`);
    }

    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new ConfigError(
            "OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key, or export it.",
        );
    }

    return {
        apiKey,
        model: flag("--model") ?? env.PI_AGENT_MODEL ?? DEFAULT_MODEL,
        mode,
        maxTurns: intFrom(flag("--max-turns") ?? env.PI_AGENT_MAX_TURNS, 25, "max-turns"),
        timeoutMs: intFrom(env.PI_AGENT_TIMEOUT_MS, 120_000, "PI_AGENT_TIMEOUT_MS"),
        maxTokens: floatFrom(env.PI_AGENT_MAX_TOKENS, "PI_AGENT_MAX_TOKENS"),
        temperature: floatFrom(env.PI_AGENT_TEMPERATURE, "PI_AGENT_TEMPERATURE"),
        cwd: env.PI_AGENT_CWD ?? process.cwd(),
    };
}
