import { test, expect, describe } from "bun:test";
import {bash} from './bash'
import {writeFile} from  "./write"
import { editFile } from "./edit"
import { mkdtemp, readFile, writeFile as fsWriteFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"


describe("bash", () => {
  test("returns stdout of a command", async () => {
    expect(await bash("echo hello")).toBe("hello\n");
  });

  test("supports pipes", async () => {
    expect(await bash("printf 'a\\nb\\nc' | wc -l")).toContain("2");
  });

  test("returns empty string when the command prints nothing", async () => {
    expect(await bash("true")).toBe("");
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
})