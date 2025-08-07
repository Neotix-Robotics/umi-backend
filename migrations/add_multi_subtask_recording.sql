-- Add SessionType enum
CREATE TYPE "SessionType" AS ENUM ('single', 'multi');

-- Add session_type column to recording_sessions
ALTER TABLE "recording_sessions"
ADD COLUMN "session_type" "SessionType" NOT NULL DEFAULT 'single';

-- Make existing fields optional for backward compatibility
ALTER TABLE "recording_sessions"
ALTER COLUMN "iteration_number" DROP NOT NULL,
ALTER COLUMN "subtask_id" DROP NOT NULL;

-- Create subtask_records table
CREATE TABLE "subtask_records" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "subtask_id" TEXT NOT NULL,
  "iteration_number" INTEGER NOT NULL,
  "timestamp" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subtask_records_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "subtask_records"
ADD CONSTRAINT "subtask_records_session_id_fkey" 
FOREIGN KEY ("session_id") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subtask_records"
ADD CONSTRAINT "subtask_records_subtask_id_fkey" 
FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add unique constraint
CREATE UNIQUE INDEX "subtask_records_session_id_subtask_id_iteration_number_key" 
ON "subtask_records"("session_id", "subtask_id", "iteration_number");

-- Migrate existing data to subtask_records
INSERT INTO "subtask_records" ("id", "session_id", "subtask_id", "iteration_number", "created_at")
SELECT 
  gen_random_uuid(),
  "id",
  "subtask_id",
  "iteration_number",
  "started_at"
FROM "recording_sessions"
WHERE "subtask_id" IS NOT NULL AND "iteration_number" IS NOT NULL;