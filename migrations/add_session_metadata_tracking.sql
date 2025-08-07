-- Add metadata tracking for session events and enhanced subtask timing

-- Step 1: Add new columns to subtask_records for timing data
ALTER TABLE "subtask_records" 
ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "duration" INTEGER, -- in milliseconds
ADD COLUMN IF NOT EXISTS "order_started" INTEGER;

-- Step 2: Create session_events table for detailed event tracking
CREATE TABLE IF NOT EXISTS "session_events" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "session_id" TEXT NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  "event_type" TEXT NOT NULL,
  "subtask_id" TEXT,
  "camera_serial" TEXT,
  "data" JSONB NOT NULL,
  "elapsed" INTEGER NOT NULL, -- milliseconds from session start
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT "fk_session_events_session"
    FOREIGN KEY ("session_id") 
    REFERENCES "recording_sessions"("id") 
    ON DELETE CASCADE
);

-- Step 3: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_session_events_session_timestamp" 
ON "session_events"("session_id", "timestamp");

CREATE INDEX IF NOT EXISTS "idx_session_events_type" 
ON "session_events"("event_type");

-- Step 4: Add comments for documentation
COMMENT ON TABLE "session_events" IS 'Stores detailed timeline of events during recording sessions';
COMMENT ON COLUMN "session_events"."elapsed" IS 'Milliseconds elapsed since session start';
COMMENT ON COLUMN "session_events"."data" IS 'Event-specific data in JSON format';

COMMENT ON COLUMN "subtask_records"."started_at" IS 'When the subtask was started';
COMMENT ON COLUMN "subtask_records"."duration" IS 'Time taken to complete subtask in milliseconds';
COMMENT ON COLUMN "subtask_records"."order_started" IS 'Order in which subtask was started (1-based)';

-- Step 5: Create a view for easy subtask analytics
CREATE OR REPLACE VIEW "subtask_analytics" AS
SELECT 
  sr.session_id,
  sr.subtask_id,
  s.title as subtask_title,
  sr.iteration_number,
  sr.started_at,
  sr.completed_at,
  sr.duration,
  sr.order_started,
  sr.order_completed,
  CASE 
    WHEN sr.duration IS NOT NULL THEN sr.duration / 1000.0 
    ELSE NULL 
  END as duration_seconds,
  rs.task_assignment_id,
  rs.started_at as session_started_at
FROM subtask_records sr
JOIN subtasks s ON sr.subtask_id = s.id
JOIN recording_sessions rs ON sr.session_id = rs.id
WHERE rs.status = 'completed';

COMMENT ON VIEW "subtask_analytics" IS 'Aggregated view of subtask performance metrics';