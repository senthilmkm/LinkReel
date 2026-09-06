/** Pull a JSON object out of model text that may include prose or fences. */
export function parseJsonObject(text: string): unknown {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('MODEL_JSON: empty model response');

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [trimmed];
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err: any) {
      lastError = err;
      try {
        return JSON.parse(repairLooseJson(candidate));
      } catch (repairErr: any) {
        lastError = repairErr;
      }
    }
  }

  throw new Error(`MODEL_JSON: ${lastError?.message || 'model did not return JSON'}`);
}

/** Trailing commas and unquoted keys are common when Flash ignores the schema. */
export function repairLooseJson(raw: string): string {
  return raw
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
}

export const FLASH_JSON_CONFIG = {
  responseMimeType: 'application/json',
  temperature: 0.3,
  thinkingConfig: { thinkingBudget: 0 },
} as const;
