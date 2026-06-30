import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import type { AuthenticatedUser } from './types';
import { API_ERRORS } from './types';

export interface TrpcContext {
  user: AuthenticatedUser | null;
  requestId: string;
}

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      const first = error.cause.issues[0];
      return {
        ...shape,
        message: `${first?.path.join('.') || 'input'}: ${first?.message}`,
        data: { code: 'VALIDATION_ERROR', httpStatus: 400 },
      };
    }
    return {
      ...shape,
      data: {
        code: (error.cause as any)?.code || shape.data?.code || 'INTERNAL_ERROR',
        httpStatus: shape.data?.httpStatus || 500,
      },
    };
  },
});

export const { router, procedure, middleware, mergeRouters } = t;

export const publicProcedure = procedure;

export const authenticatedProcedure = procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: API_ERRORS.UNAUTHORIZED.message,
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const requireIdentityProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  if (ctx.user.isAnonymous) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Linked identity required for this operation',
    });
  }
  return next({ ctx });
});
