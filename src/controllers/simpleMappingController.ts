import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import { MappingStatus } from '@prisma/client';

// Default mapping duration is 2 hours
const DEFAULT_MAPPING_DURATION_MINUTES = 120;

interface PhaseData {
  phaseType: string;
  title: string;
  requiredDuration: number;
  actualDuration: number;
}

export const createMapping = async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;
  const { 
    cameraSerials, 
    environmentName,
    phases 
  }: {
    cameraSerials: string[];
    environmentName: string;
    phases: PhaseData[];
  } = req.body;

  if (!cameraSerials || !Array.isArray(cameraSerials) || cameraSerials.length === 0) {
    return res.status(400).json({ error: 'Camera serials are required' });
  }

  if (!environmentName || !environmentName.trim()) {
    return res.status(400).json({ error: 'Environment name is required' });
  }

  if (!phases || !Array.isArray(phases) || phases.length === 0) {
    return res.status(400).json({ error: 'Phase data is required' });
  }

  // Create new mapping session with all phases completed
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + DEFAULT_MAPPING_DURATION_MINUTES);

  const mapping = await prisma.mappingSession.create({
    data: {
      createdBy: userId,
      status: MappingStatus.completed,
      environmentName: environmentName.trim(),
      startedAt: new Date(),
      completedAt: new Date(),
      expiresAt,
      cameraCount: cameraSerials.length,
      metadata: { cameraSerials },
      phases: {
        create: phases.map((phase, index) => ({
          phaseType: phase.phaseType as any,
          requiredDuration: phase.requiredDuration,
          actualDuration: phase.actualDuration,
          startedAt: new Date(), // In reality, these would be staggered
          completedAt: new Date(),
          orderIndex: index,
          metadata: { title: phase.title }
        }))
      }
    },
    include: {
      phases: {
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  res.json(mapping);
};

export const getValidMappings = async (req: AuthRequest, res: Response) => {
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
      cameraCount: mapping.cameraCount
    };
  });
  
  res.json({ mappings: mappingsWithExpiration });
};

export const validateMapping = async (req: AuthRequest, res: Response): Promise<any> => {
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
    minutesUntilExpiration
  });
};