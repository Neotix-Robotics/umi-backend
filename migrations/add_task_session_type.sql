-- Add 'task' to SessionType enum
ALTER TYPE "SessionType" ADD VALUE 'task';

-- Add new fields to subtask_records table
ALTER TABLE "subtask_records"
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "order_completed" INTEGER;

-- Make iteration_number optional for task-type sessions
ALTER TABLE "subtask_records"
ALTER COLUMN "iteration_number" DROP NOT NULL;

-- Add index for better query performance on completed subtasks
CREATE INDEX "subtask_records_session_completed_idx" ON "subtask_records"("session_id", "completed_at");