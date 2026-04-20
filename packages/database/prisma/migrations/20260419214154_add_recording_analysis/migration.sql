-- CreateEnum
CREATE TYPE "RecordingAnalysisStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "RecordingAnalysis" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "RecordingAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "standoutMoment" TEXT,
    "strengths" JSONB,
    "improvementPaths" JSONB,
    "stats" JSONB,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "regeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingAnalysis_sessionId_key" ON "RecordingAnalysis"("sessionId");

-- AddForeignKey
ALTER TABLE "RecordingAnalysis" ADD CONSTRAINT "RecordingAnalysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
