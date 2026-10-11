


export async function bash(command: string) {
    const proc = Bun.spawn(["bash", "-c", command])
    const text = await proc.stdout.text();
    return text;
}