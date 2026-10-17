/**
 * Domain chat types owned by the harness, independent of any provider SDK.
 * The agent loop works against these; the provider adapter translates to and
 * from whatever wire format it needs. Swapping providers must not touch the loop.
 */

export interface ToolCall {
    id: string;
    name: string;
    /** raw JSON string as emitted by the model, validated before use */
    arguments: string;
}

export type Message =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
    | { role: "tool"; toolCallId: string; content: string };
