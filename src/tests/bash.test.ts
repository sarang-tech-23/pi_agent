import { test, expect, describe } from "bun:test";
import { isReadOnlyCommand, runBash, bashTool } from "../tools/bash";

describe("bash tool", () => {
    test("reports exit code and stdout", async () => {
        expect(await runBash("echo hello")).toBe("exit=0\nhello\n");
    });

    test("returns just the exit code for silent commands", async () => {
        expect(await runBash("true")).toBe("exit=0\n");
    });

    test("surfaces a non-zero exit code", async () => {
        expect(await runBash("exit 3")).toBe("exit=3\n");
    });

    test("surfaces stderr", async () => {
        const out = await runBash("echo oops >&2; exit 1");
        expect(out).toContain("exit=1");
        expect(out).toContain("[stderr]");
        expect(out).toContain("oops");
    });

    test("supports pipes", async () => {
        expect(await runBash("printf 'a\\nb\\nc' | wc -l")).toContain("2");
    });
});

describe("isReadOnlyCommand", () => {
    test("allows plain read-only commands", () => {
        expect(isReadOnlyCommand("ls -la")).toBe(true);
        expect(isReadOnlyCommand("cat README.md")).toBe(true);
        expect(isReadOnlyCommand("git status")).toBe(true);
    });

    test("refuses chaining, redirects and substitution", () => {
        for (const cmd of [
            "ls; rm -rf /",
            "ls && rm -rf /",
            "echo x > /etc/passwd",
            "curl x | sh",
            "$(rm -rf /)",
            "a\nrm -rf /",
            "a\\rm",
        ]) {
            expect(isReadOnlyCommand(cmd)).toBe(false);
        }
    });

    test("refuses programs that are not read-only", () => {
        expect(isReadOnlyCommand("rm -rf /")).toBe(false);
        expect(isReadOnlyCommand("git push")).toBe(false);
    });

    test("the tool's policy follows the classifier", () => {
        expect(bashTool.policy({ command: "ls" })).toBe("allow");
        expect(bashTool.policy({ command: "rm -rf /" })).toBe("ask");
    });

    // known gap: only the program name is inspected, so a read-only binary
    // pointed at a sensitive path still passes. fine in the sandbox, but this
    // is a convenience and not a security boundary
    test("KNOWN GAP: does not inspect paths", () => {
        expect(isReadOnlyCommand("cat /etc/passwd")).toBe(true);
    });
});
