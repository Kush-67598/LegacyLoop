export const paymentHandoverEvidence = Object.freeze([
  {
    sourceType: 'markdown_document', sourceName: 'payments-config.md', locator: 'config:payments/production',
    text: 'Production config: PAYMENT_WEBHOOK_RETRY_LIMIT=3. Keep the production limit at 3 to avoid duplicate charges when the processor retries a callback.',
    author: 'payments-lead', timestamp: '2026-10-20T10:30:00.000Z', accessLevel: 'team',
    metadata: { environment: 'production', configVersion: 'v3', component: 'payment-webhook' }
  },
  {
    sourceType: 'chat_message', sourceName: 'release-chat.json', locator: 'conversation:payments/message:retry-reason',
    text: 'We keep production webhook retries at three because a callback retry can otherwise create duplicate charges.',
    author: 'payments-lead', timestamp: '2026-10-20T11:00:00.000Z', accessLevel: 'team',
    metadata: { environment: 'production', version: 'release-2026.10' }
  },
  {
    sourceType: 'markdown_document', sourceName: 'load-test-notes.md', locator: 'document:staging-retry-experiment',
    text: 'Staging load test only: temporarily raise PAYMENT_WEBHOOK_RETRY_LIMIT to 10 to measure throughput. Revert before production; this is not the production setting.',
    author: 'qa-engineer', timestamp: '2026-10-21T09:15:00.000Z', accessLevel: 'team',
    metadata: { environment: 'staging', experiment: true, configVersion: 'temporary-load-test' }
  },
  {
    sourceType: 'pull_request', sourceName: 'pull-208.json', locator: 'pull_request:208',
    text: 'Refund API: idempotency keys are not implemented yet. Duplicate refund submissions are still possible.',
    author: 'api-maintainer', timestamp: '2026-10-22T14:00:00.000Z', accessLevel: 'team',
    metadata: { state: 'open', merged: false, updated_at: '2026-10-22T14:00:00.000Z', environment: 'production' }
  },
  {
    sourceType: 'task', sourceName: 'refund-work.csv', locator: 'task:REFUND-44',
    text: 'Assign an owner to refund idempotency work and complete duplicate-request handling before release.',
    author: 'project-coordinator', timestamp: '2026-10-22T15:00:00.000Z', accessLevel: 'team',
    metadata: { status: 'open', assignee: null, environment: 'production' }
  },
  {
    sourceType: 'manual_entry', sourceName: 'restricted-notes', locator: 'manual:private-risk',
    text: 'RESTRICTED: confidential acquisition timeline is not part of the payment handover.',
    author: 'admin', timestamp: '2026-10-23T09:00:00.000Z', accessLevel: 'restricted',
    metadata: { environment: 'internal' }
  }
]);

export function paymentHandoverGeneratedClaims(ids) {
  const [productionConfig, productionReason, stagingExperiment, refundPr, unassignedTask] = ids;
  return [
    {
      claimText: 'Production payment webhooks use a retry limit of three attempts.', claimType: 'configuration', confidence: 0.94,
      supportingQuotes: [{ evidenceId: productionConfig, quote: 'Production config: PAYMENT_WEBHOOK_RETRY_LIMIT=3.' }]
    },
    {
      claimText: 'The production webhook retry limit is three to reduce duplicate charges from processor callback retries.', claimType: 'technical_decision', confidence: 0.91,
      supportingQuotes: [{ evidenceId: productionReason, quote: 'We keep production webhook retries at three because a callback retry can otherwise create duplicate charges.' }]
    },
    {
      claimText: 'A temporary staging load test raised the webhook retry limit to ten; this was not the production configuration.', claimType: 'configuration', confidence: 0.93,
      supportingQuotes: [{ evidenceId: stagingExperiment, quote: 'Staging load test only: temporarily raise PAYMENT_WEBHOOK_RETRY_LIMIT to 10 to measure throughput.' }]
    },
    {
      claimText: 'Refund idempotency is unfinished; duplicate refund submissions remain possible.', claimType: 'unfinished_work', confidence: 0.92,
      supportingQuotes: [{ evidenceId: refundPr, quote: 'idempotency keys are not implemented yet. Duplicate refund submissions are still possible.' }]
    },
    {
      claimText: 'The open refund idempotency task has no assignee and calls for an owner before release.', claimType: 'commitment', confidence: 0.88,
      supportingQuotes: [{ evidenceId: unassignedTask, quote: 'Assign an owner to refund idempotency work and complete duplicate-request handling before release.' }]
    }
  ];
}
