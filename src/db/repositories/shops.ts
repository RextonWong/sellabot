import type { PrismaClient } from '@prisma/client';

export class ShopRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(shopId: string) {
    return this.db.shop.findUnique({
      where: { id: shopId },
      include: { credentials: true },
    });
  }

  async findByPlatformId(platform: string, externalId: string) {
    return this.db.shop.findUnique({
      where: { platform_externalId: { platform, externalId } },
      include: { credentials: true },
    });
  }

  async upsert(params: {
    platform: string;
    externalId: string;
    name: string;
    region: string;
  }) {
    return this.db.shop.upsert({
      where: {
        platform_externalId: {
          platform: params.platform,
          externalId: params.externalId,
        },
      },
      create: {
        platform: params.platform,
        externalId: params.externalId,
        name: params.name,
        region: params.region,
      },
      update: { name: params.name, region: params.region },
    });
  }

  async listActive(platform?: string) {
    return this.db.shop.findMany({
      where: { active: true, platform: platform ?? undefined },
      include: { credentials: true },
    });
  }
}
