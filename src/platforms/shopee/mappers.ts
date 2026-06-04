import type {
  NormalizedProduct,
  NormalizedProductModel,
  NormalizedConversation,
  NormalizedMessage,
  NormalizedVoucher,
} from '../types';

// ── Shopee DTOs (subset of actual API responses) ──────────────────────────────

export interface ShopeeItem {
  item_id: number;
  item_name: string;
  description: string;
  category_id: number;
  image: { image_id_list: string[]; image_url_list: string[] };
  price_info?: Array<{ currency: string; original_price: number; current_price: number }>;
  stock_info_v2?: { summary_info?: { total_reserved_stock?: number; total_available_stock?: number } };
  item_status: 'NORMAL' | 'DELETED' | 'UNLIST' | 'SELLER_BANNED';
  item_sku?: string;
  attribute_list?: Array<{ attribute_id: number; attribute_value_list: Array<{ value_id: number; original_value_name: string }> }>;
  model_list?: ShopeeModel[];
}

export interface ShopeeModel {
  model_id: number;
  model_name: string;
  price_info: Array<{ original_price: number; current_price: number }>;
  stock_info_v2?: { seller_stock?: Array<{ stock: number }> };
  model_sku?: string;
}

export interface ShopeeConversation {
  conversation_id: string;
  to_id: number;
  to_name: string;
  unread_count: number;
  last_message_content?: ShopeeMessageContent;
  last_message_timestamp?: number;
}

export interface ShopeeMessage {
  message_id: string;
  from_id: number;
  content: ShopeeMessageContent;
  type: 'text' | 'image' | 'order';
  created_timestamp: number;
  status: 'read' | 'unread';
}

export interface ShopeeMessageContent {
  text?: string;
  image_url?: string;
}

export interface ShopeeVoucher {
  voucher_id: number;
  voucher_name: string;
  voucher_code: string;
  reward_type: 1 | 2;  // 1 = fixed_amount, 2 = percentage
  discount_amount?: number;
  percentage?: number;
  min_basket_price: number;
  usage_quantity?: number;
  current_usage: number;
  start_time: number;
  end_time: number;
  status: 'ongoing' | 'upcoming' | 'expired';
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function mapShopeeItem(item: ShopeeItem): NormalizedProduct {
  const priceInfo = item.price_info?.[0];
  const stock =
    item.stock_info_v2?.summary_info?.total_available_stock ?? 0;

  return {
    itemId: String(item.item_id),
    name: item.item_name,
    description: item.description,
    categoryId: item.category_id,
    images: item.image.image_url_list ?? [],
    price: priceInfo?.current_price ?? 0,
    currency: priceInfo?.currency ?? 'SGD',
    stock,
    sku: item.item_sku,
    status: mapItemStatus(item.item_status),
    attributes: mapAttributes(item.attribute_list ?? []),
    models: item.model_list?.map(mapShopeeModel),
  };
}

function mapItemStatus(status: ShopeeItem['item_status']): NormalizedProduct['status'] {
  if (status === 'DELETED') return 'deleted';
  if (status === 'UNLIST') return 'inactive';
  return 'active';
}

function mapAttributes(
  attrs: NonNullable<ShopeeItem['attribute_list']>,
): Record<string, unknown> {
  return Object.fromEntries(
    attrs.map((a) => [
      String(a.attribute_id),
      a.attribute_value_list.map((v) => v.original_value_name),
    ]),
  );
}

export function mapShopeeModel(model: ShopeeModel): NormalizedProductModel {
  const priceInfo = model.price_info?.[0];
  const stock = model.stock_info_v2?.seller_stock?.[0]?.stock ?? 0;
  return {
    modelId: String(model.model_id),
    name: model.model_name,
    price: priceInfo?.current_price ?? 0,
    stock,
    sku: model.model_sku,
  };
}

export function mapShopeeConversation(c: ShopeeConversation): NormalizedConversation {
  return {
    conversationId: c.conversation_id,
    buyerId: String(c.to_id),
    buyerName: c.to_name,
    unreadCount: c.unread_count,
    lastMessage: c.last_message_content
      ? {
          conversationId: c.conversation_id,
          messageId: '',
          senderId: String(c.to_id),
          content: c.last_message_content.text ?? '',
          type: 'text',
          timestamp: new Date((c.last_message_timestamp ?? 0) * 1000),
          read: c.unread_count === 0,
        }
      : undefined,
  };
}

export function mapShopeeMessage(
  msg: ShopeeMessage,
  conversationId: string,
): NormalizedMessage {
  return {
    conversationId,
    messageId: msg.message_id,
    senderId: String(msg.from_id),
    content: msg.content.text ?? msg.content.image_url ?? '',
    type: msg.type,
    timestamp: new Date(msg.created_timestamp * 1000),
    read: msg.status === 'read',
  };
}

export function mapShopeeVoucher(v: ShopeeVoucher): NormalizedVoucher {
  return {
    voucherId: String(v.voucher_id),
    name: v.voucher_name,
    discountType: v.reward_type === 1 ? 'fixed_amount' : 'percentage',
    discountValue: v.reward_type === 1 ? (v.discount_amount ?? 0) : (v.percentage ?? 0),
    minSpend: v.min_basket_price,
    usageLimit: v.usage_quantity ?? 0,
    usageCount: v.current_usage,
    startTime: new Date(v.start_time * 1000),
    endTime: new Date(v.end_time * 1000),
    status: v.status === 'ongoing' ? 'active' : v.status === 'upcoming' ? 'upcoming' : 'expired',
  };
}
