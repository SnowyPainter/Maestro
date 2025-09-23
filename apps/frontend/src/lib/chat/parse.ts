// lib/chat/parse.ts
export type Clause = {
    slot: string;              // ex) "account_id"
    value: string;             // ex) "3"
    span: [number, number];    // 전체 범위 (@slot:value)
    valueSpan: [number, number];
  };
  
  const MENTION_VALUE_RE = /@([a-zA-Z0-9_\-]+):([^\s]+)?/g;
  
  export function parseClauses(input: string): Clause[] {
    const result: Clause[] = [];
    for (const m of input.matchAll(MENTION_VALUE_RE)) {
      const slot = m[1];
      const value = m[2] ?? "";
      const start = m.index!;
      const end = start + m[0].length;
      const valueStart = start + (`@${slot}:`).length;
      const valueEnd = valueStart + value.length;
      result.push({
        slot,
        value,
        span: [start, end],
        valueSpan: [valueStart, valueEnd],
      });
    }
    return result;
  }
  