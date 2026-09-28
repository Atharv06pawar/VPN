import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const formatted = error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));

    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters provided',
        details: formatted,
      },
    });
  }

  // Handle Fastify schema validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      },
    });
  }

  // Handle Fastify rate limiting
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again later.',
      },
    });
  }

  // Prisma unique constraint violation (P2002)
  if ((error as any).code === 'P2002') {
    return reply.status(409).send({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A resource with this identifier or unique attribute already exists',
      },
    });
  }

  logger.error(`Unhandled error during ${request.method} ${request.url}`, {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });

  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: statusCode === 500 ? 'An unexpected server error occurred' : error.message,
    },
  });
}
