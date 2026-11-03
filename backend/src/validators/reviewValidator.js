import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ID');
const action = z.enum(['approve', 'reject', 'edit', 'needs_more_evidence']);
const base = {
  action,
  comment: z.string().trim().max(5000).optional().default(''),
  text: z.string().trim().min(1).max(5000).optional(),
  evidenceIds: z.array(objectId).max(100).optional(),
  citations: z.array(z.object({ evidenceId: objectId, quote: z.string().trim().min(1).max(5000) }).strict()).max(100).optional()
};
function reviewShape(value, context) {
  const hasEdit = value.text !== undefined || value.evidenceIds !== undefined || value.citations !== undefined;
  if (value.action === 'edit' && !hasEdit) context.addIssue({ code: 'custom', message: 'An edit must include text or updated evidence references' });
  if (value.action !== 'edit' && hasEdit) context.addIssue({ code: 'custom', message: 'Only edit actions may include claim changes' });
}
export const reviewSchema = z.object(base).strict().superRefine(reviewShape);
export const reviewQuerySchema = z.object({}).strict();
