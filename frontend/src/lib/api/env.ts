import { z } from "zod";

/**
 * Runtime environment configuration for the frontend.
 *
 * All values are read from `NEXT_PUBLIC_*` variables, which Next.js inlines
 * into the browser bundle at build time. This module parses and validates
 * them once at startup so misconfiguration surfaces as a clear diagnostic
 * error instead of a confusing runtime failure deep in the app.
 */

const stellarNetworkSchema = z.enum(["testnet", "mainnet", "futurenet"]);

const appEnvSchema = z.enum(["development", "staging", "production"]);

const urlSchema = z
  .string()
  .trim()
  .url({ message: "must be a valid URL" });

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(urlSchema.optional());

const booleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  API_BASE_URL: urlSchema,
  STELLAR_NETWORK: stellarNetworkSchema,
  RPC_URL: urlSchema,
  CONTRACT_ID: z.string().trim().optional(),
  NGN_ISSUER: z.string().trim().optional(),
  FREIGHTER_ENABLED: booleanStringSchema,
  API_VERSION_PREFIX: z.string().trim(),
  SUPABASE_URL: optionalUrlSchema,
  SUPABASE_ANON_KEY: z.string().trim().optional(),
  ADMIN_WALLETS: z.string().trim().optional(),
  ALBEDO_URL: urlSchema,
  APP_ENV: appEnvSchema,
  PINATA_GATEWAY: optionalUrlSchema,
});

export type Env = z.infer<typeof envSchema>;

const DEFAULT_RPC_URLS: Record<z.infer<typeof stellarNetworkSchema>, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
};

function readRawEnv(): Record<string, string | undefined> {
  const rawNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK?.trim() || "testnet";
  const defaultRpc =
    DEFAULT_RPC_URLS[rawNetwork as z.infer<typeof stellarNetworkSchema>] ??
    DEFAULT_RPC_URLS.testnet;

  return {
    API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_URL?.trim() ||
      "http://localhost:4000",
    STELLAR_NETWORK: rawNetwork,
    RPC_URL:
      process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim() ||
      defaultRpc,
    CONTRACT_ID: process.env.NEXT_PUBLIC_CONTRACT_ID,
    NGN_ISSUER: process.env.NEXT_PUBLIC_NGN_ISSUER,
    FREIGHTER_ENABLED: process.env.NEXT_PUBLIC_FREIGHTER_ENABLED?.trim() || "true",
    API_VERSION_PREFIX: process.env.NEXT_PUBLIC_API_VERSION_PREFIX?.trim() ?? "/api/v1",
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ADMIN_WALLETS: process.env.NEXT_PUBLIC_ADMIN_WALLETS,
    ALBEDO_URL: process.env.NEXT_PUBLIC_ALBEDO_URL?.trim() || "https://albedo.link",
    APP_ENV: process.env.NEXT_PUBLIC_APP_ENV?.trim() || "development",
    PINATA_GATEWAY: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
  };
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseEnv(): Env {
  const result = envSchema.safeParse(readRawEnv());

  if (!result.success) {
    throw new Error(
      `Invalid NEXT_PUBLIC_* environment configuration:\n${formatIssues(
        result.error,
      )}\n\nCheck your .env.local against .env.example.`,
    );
  }

  return result.data;
}

/**
 * Validated, typed environment configuration. Parsed once at module load so
 * misconfiguration fails fast with a clear diagnostic message.
 */
export const env: Env = parseEnv();

export default env;
