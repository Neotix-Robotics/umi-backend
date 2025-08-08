-- Drop local_session_id column if it exists
ALTER TABLE "recording_sessions" DROP COLUMN IF EXISTS "local_session_id";

-- Handle SessionType enum update
-- First update all existing values to valid new enum values
UPDATE "recording_sessions" SET "session_type" = 'task' WHERE "session_type" IN ('single', 'multi', 'task');

-- Create new enum type
CREATE TYPE "SessionType_new" AS ENUM ('task', 'mapping');

-- Change column type
ALTER TABLE "recording_sessions" 
  ALTER COLUMN "session_type" DROP DEFAULT,
  ALTER COLUMN "session_type" TYPE "SessionType_new" USING "session_type"::text::"SessionType_new",
  ALTER COLUMN "session_type" SET DEFAULT 'task';

-- Drop old type
DROP TYPE "SessionType";

-- Rename new type
ALTER TYPE "SessionType_new" RENAME TO "SessionType";

-- Remove subtask_id from recording_sessions (it should only be in subtask_records)
ALTER TABLE "recording_sessions" DROP CONSTRAINT IF EXISTS "recording_sessions_subtask_id_fkey";
ALTER TABLE "recording_sessions" DROP COLUMN IF EXISTS "subtask_id";

-- Ensure iteration_number is NOT NULL in recording_sessions
UPDATE "recording_sessions" SET "iteration_number" = 1 WHERE "iteration_number" IS NULL;
ALTER TABLE "recording_sessions" ALTER COLUMN "iteration_number" SET NOT NULL;

-- Update subtask_records table to match schema
ALTER TABLE "subtask_records" DROP COLUMN IF EXISTS "timestamp";
ALTER TABLE "subtask_records" DROP COLUMN IF EXISTS "order_completed";
ALTER TABLE "subtask_records" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);
ALTER TABLE "subtask_records" ADD COLUMN IF NOT EXISTS "duration" INTEGER;
ALTER TABLE "subtask_records" ADD COLUMN IF NOT EXISTS "order_started" INTEGER;
ALTER TABLE "subtask_records" ADD COLUMN IF NOT EXISTS "order_completed" INTEGER;

-- Ensure iteration_number is NOT NULL in subtask_records
UPDATE "subtask_records" SET "iteration_number" = 1 WHERE "iteration_number" IS NULL;
ALTER TABLE "subtask_records" ALTER COLUMN "iteration_number" SET NOT NULL;

-- CreateTable session_events
CREATE TABLE IF NOT EXISTS "session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "event_type" TEXT NOT NULL,
    "subtask_id" TEXT,
    "camera_serial" TEXT,
    "data" JSONB NOT NULL,
    "elapsed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_events_session_id_timestamp_idx" ON "session_events"("session_id", "timestamp");
CREATE INDEX IF NOT EXISTS "session_events_event_type_idx" ON "session_events"("event_type");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_events_session_id_fkey') THEN
        ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" 
        FOREIGN KEY ("session_id") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;