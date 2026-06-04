import type { PlatformAdapter, NormalizedProduct, NormalizedConversation, NormalizedMessage, NormalizedStockUpdate, NormalizedVoucher } from '../types';
import type { ShopeeClient } from './client';
import type { CredentialStore } from '../../services/credential-store';
import {
  mapShopeeItem,
  mapShopeeConversation,
  mapShopeeMessage,
  mapShopeeVoucher,
  type ShopeeItem,
  type ShopeeConversation,
  type ShopeeMessage,
  type ShopeeVoucher,
} from './mappers';

export class ShopeeAdapter implements PlatformAdapter {
  readonly platform = 'shopee';

  constructor(
    private readonly client: ShopeeClient,
    private readonly credStore: CredentialStore,
  ) {}

  // ── Products ────────────────────────────────────────────────────────────────

  async listProducts({ shopId, offset = 0, limit = 50 }: { shopId: string; offset?: number; limit?: number }): Promise<NormalizedProduct[]> {
    const creds = await this.credStore.getShopeeCredentials(shopId);

    const listRes = await this.client.call<{ item: Array<{ item_id: number }> }>(
      '/api/v2/product/get_item_list',
      'GET',
      creds,
    );

    if (!listRes.item?.length) return [];

    const itemIds = listRes.item.slice(offset, offset + limit).map((i) => i.item_id);
    const detailRes = await this.client.call<{ item_list: ShopeeItem[] }>(
      '/api/v2/product/get_item_base_info',
      'GET',
      creds,
    );

    return (detailRes.item_list ?? []).map(mapShopeeItem);
  }

  async getProduct({ shopId, itemId }: { shopId: string; itemId: string }): Promise<NormalizedProduct> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ item_list: ShopeeItem[] }>(
      '/api/v2/product/get_item_base_info',
      'GET',
      { ...creds },
    );
    const item = res.item_list?.[0];
    if (!item) throw new Error(`Item ${itemId} not found`);
    return mapShopeeItem(item);
  }

  async createProduct({ shopId, product }: { shopId: string; product: Omit<NormalizedProduct, 'itemId' | 'models'> }): Promise<NormalizedProduct> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ item_id: number }>(
      '/api/v2/product/add_item',
      'POST',
      creds,
      {
        original_price: product.price,
        description: product.description,
        item_name: product.name,
        category_id: product.categoryId,
        image: { image_id_list: product.images },
        normal_stock: product.stock,
        item_sku: product.sku,
        weight: product.attributes?.weight ?? 0.1,
        logistic_info: [],
        attribute_list: [],
      },
    );

    return { ...product, itemId: String(res.item_id), status: 'active', models: [] };
  }

  async updateProduct({ shopId, itemId, updates }: { shopId: string; itemId: string; updates: Partial<NormalizedProduct> }): Promise<void> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const body: Record<string, unknown> = { item_id: Number(itemId) };
    if (updates.name) body.item_name = updates.name;
    if (updates.description) body.description = updates.description;
    if (updates.images) body.image = { image_id_list: updates.images };
    await this.client.call('/api/v2/product/update_item', 'POST', creds, body);
  }

  async deleteProduct({ shopId, itemIds }: { shopId: string; itemIds: string[] }): Promise<void> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    await this.client.call('/api/v2/product/delete_item', 'POST', creds, {
      item_id_list: itemIds.map(Number),
    });
  }

  // ── Pricing ─────────────────────────────────────────────────────────────────

  async updatePrice({ shopId, itemId, modelId, price }: { shopId: string; itemId: string; modelId?: string; price: number }): Promise<void> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const priceList = modelId
      ? [{ model_id: Number(modelId), original_price: price }]
      : [{ model_id: 0, original_price: price }];

    await this.client.call(
      '/api/v2/product/update_price',
      'POST',
      creds,
      { item_id: Number(itemId), price_list: priceList },
      'pricing',
    );
  }

  // ── Inventory ───────────────────────────────────────────────────────────────

  async updateStock({ shopId, itemId, modelId, stock }: { shopId: string; itemId: string; modelId?: string; stock: number }): Promise<void> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const stockList = modelId
      ? [{ model_id: Number(modelId), seller_stock: [{ stock }] }]
      : [{ model_id: 0, seller_stock: [{ stock }] }];

    await this.client.call(
      '/api/v2/product/update_stock',
      'POST',
      creds,
      { item_id: Number(itemId), stock_list: stockList },
      'stock',
    );
  }

  async getStock({ shopId, itemId }: { shopId: string; itemId: string }): Promise<NormalizedStockUpdate[]> {
    const product = await this.getProduct({ shopId, itemId });
    if (product.models?.length) {
      return product.models.map((m) => ({
        itemId,
        modelId: m.modelId,
        stock: m.stock,
      }));
    }
    return [{ itemId, stock: product.stock }];
  }

  // ── Customer Service ────────────────────────────────────────────────────────

  async listConversations({ shopId, unreadOnly = false }: { shopId: string; unreadOnly?: boolean }): Promise<NormalizedConversation[]> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ conversations: ShopeeConversation[] }>(
      '/api/v2/sellerchat/get_conversation_list',
      'GET',
      creds,
    );
    const conversations = res.conversations ?? [];
    return conversations
      .filter((c) => !unreadOnly || c.unread_count > 0)
      .map(mapShopeeConversation);
  }

  async getMessages({ shopId, conversationId }: { shopId: string; conversationId: string }): Promise<NormalizedMessage[]> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ messages: ShopeeMessage[] }>(
      '/api/v2/sellerchat/get_message',
      'GET',
      creds,
    );
    return (res.messages ?? []).map((m) => mapShopeeMessage(m, conversationId));
  }

  async sendMessage({ shopId, conversationId, content }: { shopId: string; conversationId: string; content: string }): Promise<void> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    await this.client.call(
      '/api/v2/sellerchat/send_message',
      'POST',
      creds,
      {
        to_id: Number(conversationId),
        message_type: 'text',
        content: { text: content },
      },
      'chat',
    );
  }

  // ── Promotions ──────────────────────────────────────────────────────────────

  async createVoucher({ shopId, voucher }: { shopId: string; voucher: Omit<NormalizedVoucher, 'voucherId' | 'usageCount' | 'status'> }): Promise<NormalizedVoucher> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ voucher_id: number }>(
      '/api/v2/voucher/add_voucher',
      'POST',
      creds,
      {
        voucher_name: voucher.name,
        voucher_type: 1,  // shop voucher
        reward_type: voucher.discountType === 'fixed_amount' ? 1 : 2,
        discount_amount: voucher.discountType === 'fixed_amount' ? voucher.discountValue : undefined,
        percentage: voucher.discountType === 'percentage' ? voucher.discountValue : undefined,
        min_basket_price: voucher.minSpend ?? 0,
        usage_quantity: voucher.usageLimit,
        start_time: Math.floor(new Date(voucher.startTime).getTime() / 1000),
        end_time: Math.floor(new Date(voucher.endTime).getTime() / 1000),
      },
    );

    return {
      ...voucher,
      voucherId: String(res.voucher_id),
      usageCount: 0,
      status: 'upcoming',
    };
  }

  async listVouchers({ shopId }: { shopId: string }): Promise<NormalizedVoucher[]> {
    const creds = await this.credStore.getShopeeCredentials(shopId);
    const res = await this.client.call<{ voucher_list: ShopeeVoucher[] }>(
      '/api/v2/voucher/get_voucher_list',
      'GET',
      creds,
    );
    return (res.voucher_list ?? []).map(mapShopeeVoucher);
  }
}
