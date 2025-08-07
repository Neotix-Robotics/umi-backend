-- Make localSessionId optional since we're not using it in the simple implementation
ALTER TABLE "recording_sessions" 
ALTER COLUMN "local_session_id" DROP NOT NULL;