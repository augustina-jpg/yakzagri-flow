import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/api/env";

describe("parseEnv", () => {
  it("returns a typed env object for valid input", () => {
    const env = parseEnv({
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    });

    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
    expect(env.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");
  });

  it("throws a descriptive error when a variable is missing", () => {
    expect(() =>
      parseEnv({ NEXT_PUBLIC_STELLAR_NETWORK: "testnet" }),
    ).toThrowError(/NEXT_PUBLIC_API_URL/);
  });

  it("throws when the API URL is malformed", () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_API_URL: "not-a-url",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      }),
    ).toThrowError(/NEXT_PUBLIC_API_URL must be a valid URL/);
  });

  it("throws when a variable is empty", () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_API_URL: "https://api.example.com",
        NEXT_PUBLIC_STELLAR_NETWORK: "   ",
      }),
    ).toThrowError(/NEXT_PUBLIC_STELLAR_NETWORK must not be empty/);
  });

  it("reports every invalid variable in a single error", () => {
    expect(() => parseEnv({})).toThrowError(
      /NEXT_PUBLIC_API_URL[\s\S]*NEXT_PUBLIC_STELLAR_NETWORK/,
    );
  });
});
