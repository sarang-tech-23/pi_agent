
export async function bash(command: string) {
    const proc = Bun.spawn(["bash", "-c", command], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    return `exit=${code}\n${out}${err ? "\n[stderr]\n" + err : ""}`;
}