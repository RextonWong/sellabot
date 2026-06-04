import { z } from 'zod';

const ConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  port: z.coerce.number().default(3000),

  // Required — app cannot run without these
  databaseUrl: z.string().min(1),
  redisUrl: z.string().min(1),
  encryptionKey: z.string().min(1),

  // Optional until Shopee is approved — app boots fine without these
  googleAiApiKey: z.string().default(''),
  geminiModel: z.string().default('gemini-3.5-flash'),

  shopee: z.object({
    partnerId: z.coerce.number().default(0),
    partnerKey: z.string().default(''),
    region: z.string().default('MY'),
    redirectUrl: z.string().default(''),
    env: z.enum(['test', 'live']).default('test'),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// True only when all Shopee credentials are filled in
export function shopeeConfigured(cfg: Config): boolean {
  return cfg.shopee.partnerId > 0 && cfg.shopee.partnerKey.length > 0;
}

function loadConfig(): Config {
  const result = ConfigSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    encryptionKey: process.env.ENCRYPTION_KEY,
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    shopee: {
      partnerId: process.env.SHOPEE_PARTNER_ID,
      partnerKey: process.env.SHOPEE_PARTNER_KEY,
      region: process.env.SHOPEE_REGION,
      redirectUrl: process.env.SHOPEE_REDIRECT_URL,
      env: process.env.SHOPEE_ENV,
    },
  });

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}

export const config = loadConfig();
