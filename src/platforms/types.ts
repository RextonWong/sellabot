// ── Normalized domain models ──────────────────────────────────────────────────
// Agents work with these types; adapters translate to/from platform DTOs.

export interface NormalizedProduct {
  itemId: string;
  name: string;
  description: string;
  categoryId: number;
  images: string[];
  price: number;
  currency: string;
  stock: number;
  sku?: string;
  status: 'active' | 'inactive' | 'deleted';
  attributes: Record<string, unknown>;
  models?: NormalizedProductModel[];
}

export interface NormalizedProductModel {
  modelId: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
}

export interface NormalizedPriceUpdate {
  itemId: string;
  modelId?: string;
  originalPrice: number;
  currentPrice: number;
  currency: string;
}

export interface NormalizedStockUpdate {
  itemId: string;
  modelId?: string;
  stock: number;
}

export interface NormalizedMessage {
  conversationId: string;
  messageId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'order';
  timestamp: Date;
  read: boolean;
}

export interface NormalizedConversation {
  conversationId: string;
  buyerId: string;
  buyerName: string;
  lastMessage?: NormalizedMessage;
  unreadCount: number;
}

export interface NormalizedVoucher {
  voucherId: string;
  name: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minSpend: number;
  usageLimit: number;
  usageCount: number;
  startTime: Date;
  endTime: Date;
  status: 'active' | 'expired' | 'upcoming';
}

// ── Platform adapter interface ────────────────────────────────────────────────

export interface PlatformAdapter {
  /** Platform identifier, e.g. "shopee". */
  readonly platform: string;

  // Products
  listProducts(params: { shopId: string; offset?: number; limit?: number }): Promise<NormalizedProduct[]>;
  getProduct(params: { shopId: string; itemId: string }): Promise<NormalizedProduct>;
  createProduct(params: { shopId: string; product: Omit<NormalizedProduct, 'itemId' | 'models'> }): Promise<NormalizedProduct>;
  updateProduct(params: { shopId: string; itemId: string; updates: Partial<NormalizedProduct> }): Promise<void>;
  deleteProduct(params: { shopId: string; itemIds: string[] }): Promise<void>;

  // Pricing
  updatePrice(params: { shopId: string; itemId: string; modelId?: string; price: number }): Promise<void>;

  // Inventory
  updateStock(params: { shopId: string; itemId: string; modelId?: string; stock: number }): Promise<void>;
  getStock(params: { shopId: string; itemId: string }): Promise<NormalizedStockUpdate[]>;

  // Customer service
  listConversations(params: { shopId: string; unreadOnly?: boolean }): Promise<NormalizedConversation[]>;
  getMessages(params: { shopId: string; conversationId: string }): Promise<NormalizedMessage[]>;
  sendMessage(params: { shopId: string; conversationId: string; content: string }): Promise<void>;

  // Promotions
  createVoucher(params: { shopId: string; voucher: Omit<NormalizedVoucher, 'voucherId' | 'usageCount' | 'status'> }): Promise<NormalizedVoucher>;
  listVouchers(params: { shopId: string }): Promise<NormalizedVoucher[]>;
}
