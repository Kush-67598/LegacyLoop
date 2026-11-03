import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ID');
const citation = z.object({ evidenceId: objectId, quote: z.string().trim().min(1).max(5000) }).strict();
const accessLevel = z.enum(['team', 'leads_only', 'restricted']);
const claimType = z.enum(['ownership', 'technical_decision', 'unfinished_work', 'dependency', 'risk', 'commitment', 'configuration', 'general']);
export const createClaimSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  claimType,
  evidenceIds: z.array(objectId).max(100).optional().default([]),
  citations: z.array(citation).max(100).optional().default([]),
  accessLevel: accessLevel.optional().default('team')
}).strict();
export const updateClaimSchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  claimType: claimType.optional(),
  evidenceIds: z.array(objectId).max(100).optional(),
  citations: z.array(citation).max(100).optional(),
  accessLevel: accessLevel.optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
