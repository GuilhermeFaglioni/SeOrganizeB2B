-- AlterTable
ALTER TABLE "calendar_auth" ADD COLUMN     "last_sync_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "etag" TEXT,
ADD COLUMN     "synced_at" TIMESTAMP(3);
