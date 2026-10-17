# pi_agent

## Run in a Docker sandbox

The approval prompt is not a security boundary — the allowlist only checks the
program name, so `cat /etc/passwd` is auto-approved. Run the agent inside Docker.

The default mode is `auto`: every tool call runs without asking. Pass `--manual`
(or set `PI_AGENT_MODE=manual`) to be prompted before anything that writes or runs
a non-read-only command. Anything other than `y` is treated as a refusal.

```bash
bun run src/agent/agent.ts --manual
```

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
