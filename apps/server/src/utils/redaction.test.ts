import { afterEach, describe, expect, it } from "vitest";

import { getKnownSecrets, redactSecrets } from "./redaction.js";

describe("redactSecrets", () => {
  it("redacts a string containing exactly one known secret", () => {
    expect(redactSecrets("token=abc123secret", ["abc123secret"])).toBe(
      "token=[REDACTED]",
    );
  });

  it("redacts a string containing the same secret twice", () => {
    expect(
      redactSecrets("abc123secret and again abc123secret", ["abc123secret"]),
    ).toBe("[REDACTED] and again [REDACTED]");
  });

  it("redacts secrets at every depth of a deeply nested structure", () => {
    const input = {
      level1: {
        level2: {
          level3: ["safe", "abc123secret", { deep: "abc123secret" }],
        },
      },
    };
    const result = redactSecrets(input, ["abc123secret"]);
    expect(result).toEqual({
      level1: {
        level2: {
          level3: ["safe", "[REDACTED]", { deep: "[REDACTED]" }],
        },
      },
    });
  });

  it("returns input unchanged when secrets array is empty", () => {
    const input = { message: "nothing to hide here" };
    expect(redactSecrets(input, [])).toEqual(input);
  });

  it("does not redact everything when the secrets list includes an empty string", () => {
    const input = "just a normal sentence";
    expect(redactSecrets(input, ["", "unrelated-secret"])).toBe(input);
  });

  it("passes numbers, null, undefined, and booleans through unchanged", () => {
    const input = {
      count: 42,
      missing: null,
      notSet: undefined,
      flag: true,
      list: [1, null, undefined, false],
    };
    expect(redactSecrets(input, ["some-secret"])).toEqual(input);
  });

  it("redacts a value matching a generic pattern even when not in the known secrets list", () => {
    const result = redactSecrets("key: sk-abcdEFGH12345678", []);
    expect(result).toBe("key: [REDACTED]");
  });

  it("redacts generic patterns even when immediately preceded by a word character", () => {
    const input =
      'echo -e "$ARK_API_KEY\\nsk-1234567890abcdefGHIJ\\nep-abcd1234efgh5678\\nBearer abc123XYZ789token"';
    const result = redactSecrets(input, []);
    expect(result).toBe('echo -e "$ARK_API_KEY\\n[REDACTED]\\n[REDACTED]\\n[REDACTED]"');
  });

  it("does not mutate the input", () => {
    const input = { nested: { value: "abc123secret" } };
    const originalNestedValue = input.nested.value;
    redactSecrets(input, ["abc123secret"]);
    expect(input.nested.value).toBe(originalNestedValue);
  });
});

describe("getKnownSecrets", () => {
  const originalArkApiKey = process.env.ARK_API_KEY;
  const originalAppAuthToken = process.env.APP_AUTH_TOKEN;

  afterEach(() => {
    if (originalArkApiKey === undefined) delete process.env.ARK_API_KEY;
    else process.env.ARK_API_KEY = originalArkApiKey;
    if (originalAppAuthToken === undefined) delete process.env.APP_AUTH_TOKEN;
    else process.env.APP_AUTH_TOKEN = originalAppAuthToken;
  });

  it("returns [] when no relevant env vars are set", () => {
    delete process.env.ARK_API_KEY;
    delete process.env.APP_AUTH_TOKEN;
    expect(getKnownSecrets()).toEqual([]);
  });

  it("returns the configured values when env vars are set", () => {
    process.env.ARK_API_KEY = "test-ark-key";
    process.env.APP_AUTH_TOKEN = "test-auth-token";
    expect(getKnownSecrets()).toEqual(["test-ark-key", "test-auth-token"]);
  });
});
