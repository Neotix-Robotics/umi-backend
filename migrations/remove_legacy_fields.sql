-- Remove legacy fields migration
-- This migration removes deprecated fields and enum values from the database

-- Step 1: Update any existing 'single' or 'multi' session types to 'task'
UPDATE "recording_sessions" 
SET "session_type" = 'task' 
WHERE "session_type" IN ('single', 'multi');

-- Step 2: Drop the subtask_id foreign key constraint
ALTER TABLE "recording_sessions" 
DROP CONSTRAINT IF EXISTS "recording_sessions_subtask_id_fkey";

-- Step 3: Drop legacy columns from recording_sessions
ALTER TABLE "recording_sessions" 
DROP COLUMN IF EXISTS "local_session_id",
DROP COLUMN IF EXISTS "subtask_id";

-- Step 4: Make iteration_number required (non-nullable) in recording_sessions
-- First set any NULL values to 1
UPDATE "recording_sessions" 
SET "iteration_number" = 1 
WHERE "iteration_number" IS NULL;

-- Then make the column NOT NULL
ALTER TABLE "recording_sessions" 
ALTER COLUMN "iteration_number" SET NOT NULL;

-- Step 5: Make iteration_number required (non-nullable) in subtask_records
-- First set any NULL values to match the session's iteration number
UPDATE "subtask_records" sr
SET "iteration_number" = rs."iteration_number"
FROM "recording_sessions" rs
WHERE sr."session_id" = rs."id" 
AND sr."iteration_number" IS NULL;

-- Then make the column NOT NULL
ALTER TABLE "subtask_records" 
ALTER COLUMN "iteration_number" SET NOT NULL;

-- Step 6: Drop the timestamp column from subtask_records (unused)
ALTER TABLE "subtask_records" 
DROP COLUMN IF EXISTS "timestamp";

-- Step 7: Handle enum type change
-- First, change column to text temporarily
ALTER TABLE "recording_sessions" 
ALTER COLUMN "session_type" TYPE TEXT 
USING "session_type"::TEXT;

-- Step 8: Drop the old enum
DROP TYPE IF EXISTS "SessionType";

-- Step 9: Create new enum with only 'task' value
CREATE TYPE "SessionType" AS ENUM ('task');

-- Step 10: Convert column back to enum
ALTER TABLE "recording_sessions" 
ALTER COLUMN "session_type" TYPE "SessionType" 
USING "session_type"::"SessionType";

-- Add comments for documentation
COMMENT ON COLUMN "recording_sessions"."iteration_number" IS 'The iteration number for this recording session (1-based)';
COMMENT ON COLUMN "subtask_records"."iteration_number" IS 'The iteration number matching the parent session';