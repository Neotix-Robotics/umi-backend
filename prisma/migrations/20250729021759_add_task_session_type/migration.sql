-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('single', 'multi', 'task');

-- DropForeignKey
ALTER TABLE "recording_sessions" DROP CONSTRAINT "recording_sessions_subtask_id_fkey";

-- AlterTable
ALTER TABLE "recording_sessions" ADD COLUMN     "session_type" "SessionType" NOT NULL DEFAULT 'single',
ALTER COLUMN "iteration_number" DROP NOT NULL,
ALTER COLUMN "subtask_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "subtask_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "subtask_id" TEXT NOT NULL,
    "iteration_number" INTEGER,
    "completed_at" TIMESTAMP(3),
    "order_completed" INTEGER,
    "timestamp" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtask_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subtask_records_session_id_subtask_id_iteration_number_key" ON "subtask_records"("session_id", "subtask_id", "iteration_number");

-- AddForeignKey
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_records" ADD CONSTRAINT "subtask_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_records" ADD CONSTRAINT "subtask_records_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
