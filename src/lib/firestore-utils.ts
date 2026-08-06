export function normalizeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.toDate === "function") {
      try {
        return (record.toDate as () => Date)().toISOString();
      } catch {
        return String(value);
      }
    }

    if (typeof record.toJSON === "function") {
      try {
        return normalizeFirestoreValue((record.toJSON as () => unknown)());
      } catch {
        // fall through to plain object handling
      }
    }

    if (Array.isArray(value)) {
      return value.map(normalizeFirestoreValue);
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, nested]) => [key, normalizeFirestoreValue(nested)]),
    );
  }

  return value;
}

export function normalizeFirestoreDoc(data: Record<string, unknown> | undefined) {
  return normalizeFirestoreValue(data || {}) as Record<string, unknown>;
}
