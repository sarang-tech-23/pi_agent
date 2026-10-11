import { test, expect, describe } from "bun:test";
import {bash} from './bash'


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
