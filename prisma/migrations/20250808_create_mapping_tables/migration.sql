-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('in_progress', 'completed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "MappingPhaseType" AS ENUM ('marker_scan', 'environment_scan', 'workspace_coverage');

-- CreateTable
CREATE TABLE "mapping_sessions" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "MappingStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "extended_count" INTEGER NOT NULL DEFAULT 0,
    "camera_count" INTEGER NOT NULL,
    "environment_name" TEXT,
    "metadata" JSONB,

    CONSTRAINT "mapping_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_phases" (
    "id" TEXT NOT NULL,
    "mapping_session_id" TEXT NOT NULL,
    "phase_type" "MappingPhaseType" NOT NULL,
    "required_duration" INTEGER NOT NULL,
    "actual_duration" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "order_index" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "mapping_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mapping_phases_mapping_session_id_phase_type_key" ON "mapping_phases"("mapping_session_id", "phase_type");

-- AddForeignKey
ALTER TABLE "mapping_sessions" ADD CONSTRAINT "mapping_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_phases" ADD CONSTRAINT "mapping_phases_mapping_session_id_fkey" FOREIGN KEY ("mapping_session_id") REFERENCES "mapping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add mapping_session_id column to recording_sessions table
ALTER TABLE "recording_sessions" ADD COLUMN "mapping_session_id" TEXT;

-- AddForeignKey for recording_sessions to mapping_sessions
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_mapping_session_id_fkey" FOREIGN KEY ("mapping_session_id") REFERENCES "mapping_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;