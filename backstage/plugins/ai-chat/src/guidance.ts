/** Pure UI guidance: the server remains authoritative for schema and live option validation. */
import type { DraftField, RequestDraft, DraftValue } from './DraftControls';

export type DraftProgress = {
  completed: number;
  total: number;
  next: DraftField | null;
  blocked: boolean;
};

/**
 * Find the next REQUIRED, supported, missing field whose dependencies exist.
 * No template-specific field names, no guesses or generated option values.
 */
export function getDraftProgress(draft: RequestDraft): DraftProgress {
  const required = draft.fields.filter(field => field.required);
  const supportedMissing = required.filter(field => field.state === 'missing');
  const next =
    supportedMissing.find(field =>
      (field.dependsOn ?? []).every(parent =>
        Object.prototype.hasOwnProperty.call(draft.values, parent),
      ),
    ) ?? null;
  return {
    completed: required.filter(field => field.state === 'filled').length,
    total: required.length,
    next,
    blocked: supportedMissing.length > 0 && next === null,
  };
}

/** Parse user input into a scalar for the existing server-side draft validator. */
export function parseGuidedInput(field: DraftField, raw: string): DraftValue {
  if (raw === '') throw new Error('צריך להזין או לבחור ערך');
  const values = field.enum;
  if (field.type === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error('בחירה לא תקינה');
  }
  if (field.type === 'integer' || field.type === 'number') {
    const result = Number(raw);
    if (
      !Number.isFinite(result) ||
      (field.type === 'integer' && !Number.isSafeInteger(result))
    ) {
      throw new Error('יש להזין מספר תקין');
    }
    return result;
  }
  if (field.type === 'string') {
    if (!raw.trim()) throw new Error('ערך לא יכול להיות ריק');
    if (raw.length > 500) throw new Error('ערך ארוך מדי');
    if (values && !values.some(v => v === raw))
      throw new Error('ערך לא קיים ברשימת האפשרויות');
    return raw;
  }
  throw new Error('השדה דורש ממשק ייעודי');
}
