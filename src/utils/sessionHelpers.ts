import { RecordingSession, Subtask, SubtaskRecord } from '@prisma/client';

// Helper function to check if all required sessions are completed
// Note: This function would need to be rewritten to work with SubtaskRecords
// since RecordingSession doesn't have a direct subtaskId field
export const checkAllSessionsCompleted = (
  sessions: (RecordingSession & { subtaskRecords: SubtaskRecord[] })[],
  subtasks: Subtask[],
  requiredIterations: number
): { isComplete: boolean; missingCombinations: Array<{ subtaskId: string; iteration: number }> } => {
  const completedCombinations = new Set<string>();
  
  // Track all completed subtask/iteration combinations
  sessions.forEach(session => {
    if (session.status === 'completed') {
      session.subtaskRecords.forEach(record => {
        const key = `${record.subtaskId}-${record.iterationNumber}`;
        completedCombinations.add(key);
      });
    }
  });
  
  // Check if all required combinations exist
  const missingCombinations: Array<{ subtaskId: string; iteration: number }> = [];
  
  for (const subtask of subtasks) {
    for (let iteration = 1; iteration <= requiredIterations; iteration++) {
      const key = `${subtask.id}-${iteration}`;
      if (!completedCombinations.has(key)) {
        missingCombinations.push({ subtaskId: subtask.id, iteration });
      }
    }
  }
  
  return {
    isComplete: missingCombinations.length === 0,
    missingCombinations
  };
};