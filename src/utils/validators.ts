import Joi from 'joi';

export const authValidators = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),
  
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    fullName: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid('admin', 'collector').default('collector').optional()
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  })
};

export const assignmentValidators = {
  updateStatus: Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'completed').required()
  })
};

export const taskValidators = {
  createTask: Joi.object({
    title: Joi.string().min(3).max(255).required(),
    description: Joi.string().max(5000).optional(),
    demoVideoUrl: Joi.string().uri().optional(),
    requiredIterations: Joi.number().integer().min(1).max(100).default(1),
    requiredCameras: Joi.number().integer().min(1).max(10).default(1),
    subtasks: Joi.array().items(
      Joi.object({
        title: Joi.string().min(3).max(255).required(),
        description: Joi.string().max(1000).optional(),
        orderIndex: Joi.number().integer().min(0).optional()
      })
    ).min(1).required()
  }),
  
  updateTask: Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    description: Joi.string().max(5000).optional(),
    demoVideoUrl: Joi.string().uri().allow('', null).optional(),
    requiredIterations: Joi.number().integer().min(1).max(100).optional(),
    requiredCameras: Joi.number().integer().min(1).max(10).optional()
  }),
  
  assignTask: Joi.object({
    taskId: Joi.string().uuid().required(),
    assignedTo: Joi.string().uuid().required()
  }),
  
  uploadVideo: Joi.object({
    videoUrl: Joi.string().uri().required()
  })
};

export const recordingValidators = {
  startSession: Joi.object({
    taskAssignmentId: Joi.string().uuid().required(),
    localSessionId: Joi.number().integer().required(),
    cameraCount: Joi.number().integer().min(1).max(10).required(),
    iterationNumber: Joi.number().integer().min(1).required()
  }),
  
  updateSession: Joi.object({
    status: Joi.string().valid('started', 'completed', 'failed').required(),
    metadata: Joi.object().optional()
  }),
  
  uploadMetadata: Joi.object({
    metadata: Joi.object().required()
  })
};

export const userValidators = {
  updateProfile: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).optional()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      })
  }),
  
  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    fullName: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid('admin', 'collector').default('collector')
  }),
  
  updateUser: Joi.object({
    fullName: Joi.string().min(2).max(100).optional(),
    role: Joi.string().valid('admin', 'collector').optional()
  }).min(1)
};

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};