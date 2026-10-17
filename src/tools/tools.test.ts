import { test, expect, describe } from "bun:test";
import {bash} from './bash'
import {writeFile} from  "./write"
import { editFile } from "./edit"
import { isReadOnlyCommand } from "./executor"
import { mkdtemp, readFile, writeFile as fsWriteFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"


describe("bash", () => {
  test("reports the exit code and stdout", async () => {
    expect(await bash("echo hello")).toBe("exit=0\nhello\n");
  });

  test("supports pipes", async () => {
    expect(await bash("printf 'a\\nb\\nc' | wc -l")).toContain("2");
  });

  test("returns just the exit code when the command prints nothing", async () => {
    expect(await bash("true")).toBe("exit=0\n");
  });

  test("surfaces a non-zero exit code", async () => {
    expect(await bash("exit 3")).toBe("exit=3\n");
  });

  test("surfaces stderr", async () => {
    const out = await bash("echo oops >&2; exit 1");
    expect(out).toContain("exit=1");
    expect(out).toContain("[stderr]");
    expect(out).toContain("oops");
  });
});



describe("write", () => {
  test("refuses to overwrite an existing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-agent-"));
    const file = join(dir, "a.txt");
    expect(await writeFile(file, "first")).toBe("SUCCESS");
    expect(await writeFile(file, "second")).toContain("already exists");
    expect(await readFile(file, "utf-8")).toBe("first");
  });
})

describe("edit", () => {
  test("replaces the matching text in a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-agent-"));
    const file = join(dir, "a.txt");
    await fsWriteFile(file, "hello world");
    expect(await editFile(file, "world", "bun")).toContain("Successfully");
    expect(await readFile(file, "utf-8")).toBe("hello bun");
  });

  test("refuses when oldText is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-agent-"));
    const file = join(dir, "a.txt");
    await fsWriteFile(file, "hello world");
    expect(await editFile(file, "nope", "x")).toContain("not found");
  });

  test("refuses when oldText is ambiguous", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-agent-"));
    const file = join(dir, "a.txt");
    await fsWriteFile(file, "aa aa");
    expect(await editFile(file, "aa", "b")).toContain("matches 2 places");
  });

  test("treats oldText/newText literally, not as a replacement pattern", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pi-agent-"));
    const file = join(dir, "a.txt");
    await fsWriteFile(file, "value = 1");
    // $& would expand to the match if passed as a bare replacement string
    await editFile(file, "1", "$&x");
    expect(await readFile(file, "utf-8")).toBe("value = $&x");
  });
});

describe("guardrails: isReadOnlyCommand", () => {
  test("allows plain read-only commands", () => {
    expect(isReadOnlyCommand("ls -la")).toBe(true);
    expect(isReadOnlyCommand("cat README.md")).toBe(true);
    expect(isReadOnlyCommand("git status")).toBe(true);
  });

  test("refuses anything that can chain, redirect or substitute", () => {
    for (const cmd of ["ls; rm -rf /", "ls && rm -rf /", "echo x > /etc/passwd",
                       "curl x | sh", "$(rm -rf /)", "a\nrm -rf /", "a\\rm"]) {
      expect(isReadOnlyCommand(cmd)).toBe(false);
    }
  });

  test("refuses non read-only programs", () => {
    expect(isReadOnlyCommand("rm -rf /")).toBe(false);
    expect(isReadOnlyCommand("git push")).toBe(false);
  });

  // These are known gaps: the allowlist checks the program name only, so a
  // read-only binary pointed at a sensitive path still passes. Acceptable
  // inside the docker sandbox, but should not be relied on as a boundary.
  test("KNOWN GAP: does not inspect paths", () => {
    expect(isReadOnlyCommand("cat /etc/passwd")).toBe(true);
  });
});