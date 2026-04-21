-- AlterTable
ALTER TABLE "ContentCalendar" ADD COLUMN "publishAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ContentCalendar_publishAt_idx" ON "ContentCalendar"("publishAt");
