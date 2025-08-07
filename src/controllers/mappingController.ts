import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import { MappingStatus, MappingPhaseType } from '@prisma/client';

// Default mapping duration is 2 hours
const DEFAULT_MAPPING_DURATION_MINUTES = 120;
// Maximum extensions allowed per mapping
const MAX_EXTENSIONS = 3;

// Phase configurations with required durations in seconds
const PHASE_CONFIGS = [
  {
    phaseType: MappingPhaseType.marker_scan,
    requiredDuration: 20,
    orderIndex: 0,
    title: 'Marker Scan',
    description: 'Slowly move left and right while pointing at the ArUco marker'
  },
  {
    phaseType: MappingPhaseType.environment_scan,
    requiredDuration: 10,
    orderIndex: 1,
    title: 'Environment Scan',
    description: 'Slowly rotate to scan the environment'
  },
  {
    phaseType: MappingPhaseType.workspace_coverage,
    requiredDuration: 30,
    orderIndex: 2,
    title: 'Workspace Coverage',
    description: 'Move across workspace as if performing tasks'
  }
];

export const startMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { cameraSerials } = req.body;

  if (!cameraSerials || !Array.isArray(cameraSerials) || cameraSerials.length === 0) {
    return res.status(400).json({ error: 'Camera serials are required' });
  }

  // Check if user has an in-progress mapping session (allow multiple completed ones)
  const inProgressMapping = await prisma.mappingSession.findFirst({
    where: {
      createdBy: userId,
      status: MappingStatus.in_progress
    }
  });

  if (inProgressMapping) {
    return res.status(400).json({ 
      error: 'You have a mapping session in progress. Please complete it before starting a new one.',
      mappingId: inProgressMapping.id
    });
  }

  // Create new mapping session with phases
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + DEFAULT_MAPPING_DURATION_MINUTES);

  const mapping = await prisma.mappingSession.create({
    data: {
      createdBy: userId,
      status: MappingStatus.in_progress,
      expiresAt,
      cameraCount: cameraSerials.length,
      metadata: { cameraSerials },
      phases: {
        create: PHASE_CONFIGS.map(config => ({
          phaseType: config.phaseType,
          requiredDuration: config.requiredDuration,
          orderIndex: config.orderIndex
        }))
      }
    },
    include: {
      phases: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  // Transform phases to include config info
  const phasesWithConfig = mapping.phases.map((phase: any) => {
    const config = PHASE_CONFIGS.find(c => c.phaseType === phase.phaseType)!;
    return {
      ...phase,
      title: config.title,
      description: config.description
    };
  });

  res.json({
    ...mapping,
    phases: phasesWithConfig
  });
};

export const updatePhase = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { mappingId, phaseType } = req.params;
  const { action, environmentName, metadata } = req.body; // 'start' or 'complete', optional environmentName and metadata

  if (!['start', 'complete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be "start" or "complete"' });
  }

  // Verify mapping ownership and status
  const mapping = await prisma.mappingSession.findFirst({
    where: {
      id: mappingId,
      createdBy: userId,
      status: MappingStatus.in_progress
    },
    include: {
      phases: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  if (!mapping) {
    return res.status(404).json({ error: 'Mapping session not found or not in progress' });
  }

  // Check if mapping has expired
  if (new Date() > mapping.expiresAt) {
    await prisma.mappingSession.update({
      where: { id: mappingId },
      data: { status: MappingStatus.expired }
    });
    return res.status(400).json({ error: 'Mapping session has expired' });
  }

  // Find the phase
  const phase = mapping.phases.find(p => p.phaseType === phaseType);
  if (!phase) {
    return res.status(404).json({ error: 'Phase not found' });
  }

  if (action === 'start') {
    // Check if previous phases are completed
    const previousPhases = mapping.phases.filter(p => p.orderIndex < phase.orderIndex);
    const allPreviousCompleted = previousPhases.every(p => p.completedAt !== null);
    
    if (!allPreviousCompleted) {
      return res.status(400).json({ error: 'Previous phases must be completed first' });
    }

    // Start the phase
    const updatedPhase = await prisma.mappingPhase.update({
      where: { id: phase.id },
      data: { startedAt: new Date() }
    });

    return res.json(updatedPhase);
  } else {
    // Complete the phase
    if (!phase.startedAt) {
      return res.status(400).json({ error: 'Phase must be started before completing' });
    }

    // Calculate actual duration
    const actualDuration = Math.floor((new Date().getTime() - phase.startedAt.getTime()) / 1000);
    
    // Check if minimum duration is met
    if (actualDuration < phase.requiredDuration) {
      return res.status(400).json({ 
        error: 'Minimum duration not met',
        requiredDuration: phase.requiredDuration,
        actualDuration,
        remainingSeconds: phase.requiredDuration - actualDuration
      });
    }

    // Complete the phase
    const updateData: any = {
      completedAt: new Date(),
      actualDuration
    };
    
    // If metadata is provided, store it
    if (metadata) {
      updateData.metadata = metadata;
    }
    
    const updatedPhase = await prisma.mappingPhase.update({
      where: { id: phase.id },
      data: updateData
    });

    // Check if all phases are completed
    const allPhasesCompleted = mapping.phases
      .filter(p => p.id !== phase.id)
      .every(p => p.completedAt !== null);

    if (allPhasesCompleted) {
      // Auto-complete the mapping session
      const updateData: any = {
        status: MappingStatus.completed,
        completedAt: new Date()
      };
      
      // If environment name is provided, save it
      if (environmentName) {
        updateData.environmentName = environmentName;
      }
      
      await prisma.mappingSession.update({
        where: { id: mappingId },
        data: updateData
      });
    }

    return res.json({
      phase: updatedPhase,
      allPhasesCompleted
    });
  }
};

export const completeMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { mappingId } = req.params;
  const { environmentName } = req.body;

  const mapping = await prisma.mappingSession.findFirst({
    where: {
      id: mappingId,
      createdBy: userId,
      status: MappingStatus.in_progress
    },
    include: {
      phases: true
    }
  });

  if (!mapping) {
    return res.status(404).json({ error: 'Mapping session not found or not in progress' });
  }

  // Check if all phases are completed
  const allPhasesCompleted = mapping.phases.every(p => p.completedAt !== null);
  
  if (!allPhasesCompleted) {
    return res.status(400).json({ error: 'All phases must be completed before finalizing mapping' });
  }

  const updateData: any = {
    status: MappingStatus.completed,
    completedAt: new Date()
  };
  
  // If environment name is provided, save it
  if (environmentName) {
    updateData.environmentName = environmentName;
  }
  
  const updatedMapping = await prisma.mappingSession.update({
    where: { id: mappingId },
    data: updateData
  });

  res.json(updatedMapping);
};

export const extendMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { mappingId } = req.params;

  const mapping = await prisma.mappingSession.findFirst({
    where: {
      id: mappingId,
      createdBy: userId,
      status: MappingStatus.completed
    }
  });

  if (!mapping) {
    return res.status(404).json({ error: 'Completed mapping session not found' });
  }

  // Can only extend if not already extended too many times
  if (mapping.extendedCount >= MAX_EXTENSIONS) {
    return res.status(400).json({ error: 'Maximum number of extensions reached' });
  }

  // Extend by 30 minutes from now
  const newExpiresAt = new Date();
  newExpiresAt.setMinutes(newExpiresAt.getMinutes() + DEFAULT_MAPPING_DURATION_MINUTES);

  const updatedMapping = await prisma.mappingSession.update({
    where: { id: mappingId },
    data: {
      expiresAt: newExpiresAt,
      extendedCount: mapping.extendedCount + 1
    }
  });

  res.json({
    ...updatedMapping,
    message: `Mapping extended for another ${DEFAULT_MAPPING_DURATION_MINUTES} minutes`
  });
};

export const getActiveMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const mapping = await prisma.mappingSession.findFirst({
    where: {
      createdBy: userId,
      status: MappingStatus.in_progress  // Only return in-progress mappings
    },
    include: {
      phases: {
        orderBy: { orderIndex: 'asc' }
      }
    },
    orderBy: {
      startedAt: 'desc'
    }
  });

  if (!mapping) {
    return res.json({ mapping: null });
  }

  // Transform phases to include config info
  const phasesWithConfig = mapping.phases.map((phase: any) => {
    const config = PHASE_CONFIGS.find(c => c.phaseType === phase.phaseType)!;
    return {
      ...phase,
      title: config.title,
      description: config.description
    };
  });

  // Calculate time until expiration
  const minutesUntilExpiration = Math.floor((mapping.expiresAt.getTime() - new Date().getTime()) / 1000 / 60);

  res.json({
    mapping: {
      ...mapping,
      phases: phasesWithConfig,
      minutesUntilExpiration,
      canExtend: mapping.status === MappingStatus.completed && mapping.extendedCount < MAX_EXTENSIONS
    }
  });
};

export const getValidMappings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  
  const mappings = await prisma.mappingSession.findMany({
    where: {
      createdBy: userId,
      status: MappingStatus.completed,
      expiresAt: { gt: new Date() }
    },
    orderBy: {
      completedAt: 'desc'
    }
  });
  
  // Add time until expiration for each mapping
  const mappingsWithExpiration = mappings.map(mapping => {
    const minutesUntilExpiration = Math.floor((mapping.expiresAt.getTime() - new Date().getTime()) / 1000 / 60);
    return {
      id: mapping.id,
      environmentName: mapping.environmentName || 'Unnamed Environment',
      completedAt: mapping.completedAt,
      expiresAt: mapping.expiresAt,
      minutesUntilExpiration,
      canExtend: mapping.extendedCount < MAX_EXTENSIONS,
      cameraCount: mapping.cameraCount
    };
  });
  
  res.json({ mappings: mappingsWithExpiration });
};

export const validateMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { mappingId } = req.body;

  if (!mappingId) {
    return res.status(400).json({ error: 'Mapping ID is required' });
  }

  const mapping = await prisma.mappingSession.findFirst({
    where: {
      id: mappingId,
      createdBy: userId,
      status: MappingStatus.completed,
      expiresAt: { gt: new Date() }
    }
  });

  if (!mapping) {
    return res.json({ 
      valid: false,
      reason: 'Mapping not found, not completed, or expired'
    });
  }

  const minutesUntilExpiration = Math.floor((mapping.expiresAt.getTime() - new Date().getTime()) / 1000 / 60);

  res.json({
    valid: true,
    mappingId: mapping.id,
    expiresAt: mapping.expiresAt,
    minutesUntilExpiration,
    canExtend: mapping.extendedCount < MAX_EXTENSIONS
  });
};