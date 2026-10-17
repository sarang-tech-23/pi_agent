import { createInterface } from "node:readline/promises";
import { ConfigError, loadConfig } from "../config";
import type { Message } from "../messages";
import { createOpenRouterClient } from "../provider/openrouter";
import { createRegistry } from "../tools";
import { runAgent, type Ui } from "./agent";

const SYSTEM_PROMPT = "you are an helpfull assitent";

/**
 * A Ui backed by the terminal. The readline instance is created here and passed
 * into the loop, so nothing else reaches for process.stdin and the harness can
 * be driven by a scripted Ui in tests.
 */
function createTerminalUi(): { ui: Ui; rl: ReturnType<typeof createInterface>; isClosed: () => boolean } {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // `rl.closed` exists at runtime but is not in the type declarations, so
    // track it from the close event instead of casting
    let closed = false;
    rl.on("close", () => {
        closed = true;
    });
    return {
        rl,
        isClosed: () => closed,
        ui: {
            say: (text) => console.log(text),
            confirm: async (name, args) => {
                // no way to ask means do not run it
                if (closed) return false;
                console.log(`\n[approval needed] ${name}`);
                console.log(JSON.stringify(args, null, 2));
                try {
                    const answer = await rl.question("run this? (y/N) ");
                    return answer.trim().toLowerCase() === "y";
                } catch {
                    // the interface can close while the prompt is pending
                    return false;
                }
            },
        },
    };
}

async function main() {
    let config;
    try {
        config = loadConfig();
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error(`config error: ${err.message}`);
            process.exit(2);
        }
        throw err;
    }

    const llm = await createOpenRouterClient({
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
    });
    const tools = createRegistry();

    const { ui, rl, isClosed } = createTerminalUi();

    // a fresh controller per query, so ctrl-c interrupts the in-flight request
    // instead of killing the process mid-tool-call
    let controller = new AbortController();
    process.on("SIGINT", () => controller.abort());

    // the history persists here so follow-up questions keep their context
    const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

    console.log(
        `pi_agent ready (mode: ${config.mode}, model: ${config.model}). ` +
            `type your query, "exit" or ctrl-d to quit.`,
    );
    rl.setPrompt("> ");
    rl.prompt();

    // in auto mode no confirm is passed, so nothing ever prompts
    const activeUi: Ui = config.mode === "manual" ? ui : { say: ui.say };

    for await (const line of rl) {
        const query = line.trim();
        if (query === "exit") break;

        if (query) {
            messages.push({ role: "user", content: query });
            controller = new AbortController();
            try {
                const result = await runAgent(
                    { llm, tools, ui: activeUi, cwd: config.cwd },
                    messages,
                    { maxTurns: config.maxTurns, signal: controller.signal },
                );
                if (result.exhausted) {
                    console.log(`\n[stopped] hit the ${result.turns} turn limit without a final answer.`);
                } else if (result.content) {
                    console.log(` ######### Final Answer ######### \n ${result.content}`);
                }
            } catch (err: any) {
                if (controller.signal.aborted) {
                    console.log("\n[interrupted]");
                } else {
                    console.log(`error: ${err.message}`);
                }
            }
        }

        // a long query can outlive the input stream (piped input, ctrl-d while
        // the model is working), which closes readline out from under us.
        // prompting a closed interface throws ERR_USE_AFTER_CLOSE.
        if (isClosed()) break;
        rl.prompt();
    }
    if (!isClosed()) rl.close();
}

if (import.meta.main) {
    await main();
}
