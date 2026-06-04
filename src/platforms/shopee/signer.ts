import { createHmac } from 'crypto';

/**
 * Shopee Open Platform v2 request signer.
 *
 * Public API base string:  partner_id + path + timestamp
 * Shop-level base string:  partner_id + path + timestamp + access_token + shop_id
 */

export interface ShopeeSignParams {
  partnerId: number;
  partnerKey: string;
  path: string;           // e.g. "/api/v2/product/get_item_list"
  timestamp: number;      // Unix seconds
  accessToken?: string;   // required for shop-level calls
  shopId?: number;        // required for shop-level calls
}

export function sign(params: ShopeeSignParams): string {
  const { partnerId, partnerKey, path, timestamp, accessToken, shopId } = params;

  const parts: (string | number)[] = [partnerId, path, timestamp];
  if (accessToken !== undefined && shopId !== undefined) {
    parts.push(accessToken, shopId);
  }

  const baseString = parts.join('');
  return createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export function buildCommonParams(params: ShopeeSignParams): Record<string, string | number> {
  const { partnerId, timestamp, accessToken, shopId } = params;
  const signature = sign(params);

  const common: Record<string, string | number> = {
    partner_id: partnerId,
    timestamp,
    sign: signature,
  };

  if (accessToken !== undefined) common.access_token = accessToken;
  if (shopId !== undefined) common.shop_id = shopId;

  return common;
}
