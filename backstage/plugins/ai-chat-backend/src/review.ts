/** Explicit human review marker; never creates a Scaffolder task or platform request. */
import { createHash } from 'node:crypto';
import type { RequestDraft } from './draft';
import { updateDraft } from './draft';
import type { McpClient } from './agent';

export type DraftReview = { fingerprint: string; confirmedAt: string };

export function fingerprint(draft: RequestDraft): string {
  const pairs = Object.entries(draft.values).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return createHash('sha256')
    .update(JSON.stringify([draft.templateRef, pairs]))
    .digest('hex');
}
export async function confirmDraftReview(
  mcp: McpClient,
  current: RequestDraft | undefined,
): Promise<{
  draft: RequestDraft;
  review: DraftReview;
}> {
  if (!current) throw new Error('No request draft to review');
  // Re-fetch current schema AND live dynamic option lists at the moment of confirmation.
  const draft = await updateDraft({
    mcp,
    current,
    templateRef: current.templateRef,
  });
  if (!draft.readyForReview)
    throw new Error('Request draft is incomplete or requires a dedicated form');
  return {
    draft,
    review: {
      fingerprint: fingerprint(draft),
      confirmedAt: new Date().toISOString(),
    },
  };
}
