import { z } from 'zod';
export const acknowledgementSchema = z.object({
  itemId: z.string().trim().min(1).max(200),
  action: z.enum(['acknowledge', 'unclear', 'request_clarification']),
  comment: z.string().trim().max(5000).optional().default('')
}).strict();
