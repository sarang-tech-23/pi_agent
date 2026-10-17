# pi_agent

A small tool-calling agent harness. Give it a query and it will read files, run
bash, or write and edit files until it can answer.

## Layout

```
src/
  agent/agent.ts     the tool-calling loop, depends only on injected ports
  agent/cli.ts       the terminal entry point: wires up ports and reads stdin
  provider/port.ts   LlmClient interface the loop talks to
  provider/openrouter.ts  OpenRouter adapter implementing that interface
  tools/tool.ts      the Tool type: schema, policy and implementation in one place
  tools/registry.ts  lookup, validation, approval, dispatch
  tools/index.ts     the list of tools the harness exposes
  config.ts          environment and CLI configuration
  messages.ts        provider-neutral message types
```

The loop in `agent.ts` takes its model client, tool registry and UI as
parameters, so it can be driven by a stub in tests without a network call or a
terminal. See `src/tests/agent.test.ts`.

## Adding a tool

Create one file exporting a `Tool`, then add it to `ALL_TOOLS` in
`src/tools/index.ts`. Nothing else needs editing: the model-facing JSON schema is
generated from the tool's zod schema, and the approval policy travels with the
tool, so there is no separate dispatch switch or schema list to keep in sync.

```ts
export const myTool: Tool<typeof schema> = {
    name: "myTool",
    description: "...",
    schema,
    policy: () => "ask",          // or "allow"
    run: async (args, ctx) => "...",
};
```

Arguments are validated against `schema` before `run` is called, so a
wrong-typed argument is reported back to the model instead of reaching the
implementation.

## Configuration

Everything tunable is read from the environment; see `.env.example`. The model,
turn limit and timeout are data, so changing them does not require a code edit.
CLI flags override the environment:

```bash
bun run src/agent/cli.ts --model anthropic/claude-sonnet-4 --max-turns 10
```

## Run in a Docker sandbox

The approval prompt is not a security boundary. The read-only classifier checks
the program name only, so `cat /etc/passwd` is auto-approved. Run the agent
inside Docker.

The default mode is `auto`: every tool call runs without asking. Pass `--manual`
(or set `PI_AGENT_MODE=manual`) to be prompted before anything that writes or
runs a non-read-only command. Anything other than `y` is treated as a refusal.

### Build the image

```bash
docker build -f dockerfile -t pi-agent .
```

### Run the container

```bash
mkdir -p sandbox
docker run -it --rm \
  --env-file .env \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 1g --pids-limit 256 \
  -v "$PWD/sandbox":/workspace \
  pi-agent
```

## Development

```bash
bun install
bun test          # tests run with no network or API key
bun run typecheck
bun start
```
