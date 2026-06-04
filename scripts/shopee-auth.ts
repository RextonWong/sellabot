/**
 * Interactive CLI to kick off Shopee OAuth for a shop.
 * Usage: pnpm shopee:auth
 *
 * Prints the auth URL, waits for you to paste the callback URL,
 * then exchanges the code and saves the tokens.
 */
import 'dotenv/config';
import * as readline from 'readline';
import { config } from '../src/config';
import db from '../src/db/client';
import { CredentialStore } from '../src/services/credential-store';
import { ShopeeClient } from '../src/platforms/shopee/client';
import { ShopeeAuth } from '../src/platforms/shopee/auth';
import { ShopRepository } from '../src/db/repositories/shops';
import { RateLimiter } from '../src/core/ratelimit';
import { Redis } from 'ioredis';

async function main() {
  const redis = new Redis(config.redisUrl);
  const rateLimiter = new RateLimiter(redis);
  const credStore = new CredentialStore(db);
  const shopRepo = new ShopRepository(db);
  const client = new ShopeeClient(config.shopee, rateLimiter);
  const auth = new ShopeeAuth(config.shopee, client);

  const authUrl = auth.buildAuthUrl();
  console.log('\n=== Shopee OAuth ===');
  console.log('1. Open this URL in your browser and authorize the app:');
  console.log('\n' + authUrl + '\n');
  console.log('2. After authorizing, you will be redirected. Copy the FULL callback URL.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const callbackUrl: string = await new Promise((resolve) => {
    rl.question('Paste the callback URL here: ', resolve);
  });
  rl.close();

  const url = new URL(callbackUrl.trim());
  const code = url.searchParams.get('code');
  const shopIdStr = url.searchParams.get('shop_id');

  if (!code || !shopIdStr) {
    console.error('Could not extract code or shop_id from URL');
    process.exit(1);
  }

  const shopExternalId = Number(shopIdStr);
  console.log(`\nExchanging code for tokens (shop_id: ${shopExternalId})...`);

  const tokens = await auth.exchangeCode(code, shopExternalId);

  const shop = await shopRepo.upsert({
    platform: 'shopee',
    externalId: String(shopExternalId),
    name: `Shopee Shop ${shopExternalId}`,
    region: config.shopee.region,
  });

  await credStore.saveTokens(shop.id, tokens);

  console.log('\n✓ Tokens saved!');
  console.log(`  Shop ID (internal): ${shop.id}`);
  console.log(`  Access token expires: ${tokens.accessTokenExpiresAt.toISOString()}`);
  console.log('\nUse this shopId in your API calls: ' + shop.id);

  await redis.quit();
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
