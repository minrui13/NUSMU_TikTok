const SECRET_ENV_VARS = ["ARK_API_KEY", "APP_AUTH_TOKEN"];

export function getKnownSecrets(): string[] {
  return SECRET_ENV_VARS.map((name) => process.env[name]).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

// Generic patterns for secrets we don't have the literal value for
// (e.g. a truncated/partial key surfacing in a stack trace).
const GENERIC_SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /ep-[A-Za-z0-9_-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi,
];

export function redactSecrets<T>(value: T, secrets: string[]): T {
  const cleanSecrets = secrets.filter((s) => s.length > 0);

  function redactString(input: string): string {
    let out = input;
    for (const secret of cleanSecrets) {
      out = out.split(secret).join("");
    }
    for (const pattern of GENERIC_SECRET_PATTERNS) {
      out = out.replace(pattern, "");
    }
    return out;
  }

  function walk(input: any): any {
    if (typeof input === "string") return redactString(input);
    if (Array.isArray(input)) return input.map(walk);
    if (input && typeof input === "object") {
      const result: Record<string, any> = {};
      for (const key of Object.keys(input)) {
        result[key] = walk(input[key]);
      }
      return result;
    }
    return input;
  }

  return walk(value);
}
