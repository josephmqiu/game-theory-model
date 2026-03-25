export function toNullableText(value: string | null | undefined): string | null {
  return value === undefined ? null : value;
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

export function parseJsonColumn<T>(value: unknown, fieldName: string): T {
  if (typeof value !== "string") {
    throw new Error(`Corrupt workspace database: ${fieldName} must be text.`);
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Corrupt workspace database: ${fieldName} is not valid JSON.`);
  }
}

