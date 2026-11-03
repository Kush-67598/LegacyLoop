import { z } from 'zod';
const requiredText = (max) => z.string().trim().min(1).max(max);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB ID');
export const createCaseSchema = z.object({ title: requiredText(200), description: z.string().trim().max(5000).optional().default(''), projectName: requiredText(200), departingMember: requiredText(200), successor: requiredText(200) }).strict();
export const updateCaseSchema = z.object({ title: requiredText(200).optional(), description: z.string().trim().max(5000).optional(), projectName: requiredText(200).optional(), departingMember: requiredText(200).optional(), successor: requiredText(200).optional(), reviewerIds: z.array(objectId).max(50).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
