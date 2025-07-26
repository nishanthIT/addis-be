-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderTiming" TEXT NOT NULL DEFAULT 'asap',
ADD COLUMN     "preorderDate" TEXT,
ADD COLUMN     "preorderTime" TEXT;
