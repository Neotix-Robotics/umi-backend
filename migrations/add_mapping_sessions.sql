-- Add mapping_session_id to recording_sessions table
ALTER TABLE recording_sessions 
ADD COLUMN IF NOT EXISTS mapping_session_id UUID REFERENCES mapping_sessions(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_recording_sessions_mapping_session_id 
ON recording_sessions(mapping_session_id);