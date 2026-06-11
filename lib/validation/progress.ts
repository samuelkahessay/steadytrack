import { z } from 'zod';

export const ProgressCompleteSchema = z.object({
  planId: z.string().uuid(),
  subject: z.string().min(1),
  unitId: z.string().min(1),
});

export const ProgressUndoSchema = z.object({
  planId: z.string().uuid(),
  unitId: z.string().min(1),
});

export const BulkProgressOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('completed'),
    planId: z.string().uuid(),
    subject: z.string().min(1),
    unitId: z.string().min(1),
  }),
  z.object({
    type: z.literal('undone'),
    planId: z.string().uuid(),
    unitId: z.string().min(1),
  }),
]);

export const BulkProgressSchema = z.object({
  operations: z.array(BulkProgressOperationSchema).min(1),
});

