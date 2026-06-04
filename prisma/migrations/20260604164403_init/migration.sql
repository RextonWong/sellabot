-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'QUEUED', 'IN_PROGRESS', 'NEEDS_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('TASK_CREATED', 'TASK_QUEUED', 'TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_NEEDS_APPROVAL', 'TASK_APPROVED', 'TASK_REJECTED', 'API_CALL_INTENT', 'API_CALL_SUCCESS', 'API_CALL_ERROR');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCredential" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "encryptedTokens" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "parentTaskId" TEXT,
    "result" JSONB,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "taskId" TEXT,
    "action" "AuditAction" NOT NULL,
    "agent" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "outcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "modelId" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shop_platform_active_idx" ON "Shop"("platform", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_platform_externalId_key" ON "Shop"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCredential_shopId_key" ON "ShopCredential"("shopId");

-- CreateIndex
CREATE INDEX "ShopCredential_accessTokenExpiresAt_idx" ON "ShopCredential"("accessTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_idempotencyKey_key" ON "Task"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Task_shopId_status_idx" ON "Task"("shopId", "status");

-- CreateIndex
CREATE INDEX "Task_kind_status_idx" ON "Task"("kind", "status");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_taskId_idx" ON "AuditLog"("taskId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_shopId_itemId_recordedAt_idx" ON "PriceSnapshot"("shopId", "itemId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ShopCredential" ADD CONSTRAINT "ShopCredential_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
