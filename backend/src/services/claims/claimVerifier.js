import { validateCitations } from './citationValidator.js';

export async function verifyClaimSupport(claim, evidence) {
  return { result: 'needs_ai_review', reason: 'AI support verification has not been configured.' };
}

export async function verifyClaim(claim, evidence) {
  const citationCheck = validateCitations(claim, evidence);
  if (!citationCheck.valid) {
    return {
      status: citationCheck.result === 'missing_evidence' ? 'missing_evidence' : 'unsupported',
      verification: { citationCheck: { ...citationCheck, checkedAt: new Date() }, supportCheck: { result: 'not_run', reason: 'Citation validation failed.' } }
    };
  }
  const supportCheck = await verifyClaimSupport(claim, evidence);
  return { status: supportCheck.result, verification: { citationCheck: { ...citationCheck, checkedAt: new Date() }, supportCheck } };
}
