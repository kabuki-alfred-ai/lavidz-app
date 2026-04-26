-- Add editorial/content strategy fields to EntrepreneurProfile
ALTER TABLE "EntrepreneurProfile"
  ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "websiteIngestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editorialPillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "editorialTone" TEXT,
  ADD COLUMN IF NOT EXISTS "editorialValidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "targetFrequency" INTEGER;
