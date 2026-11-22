import { useEffect, useState, type FormEvent } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { getDraftProgress, parseGuidedInput } from './guidance';
import type { DraftReview, RequestDraft, DraftValue } from './DraftControls';

type Option = { value: string | number; label: string };
type OptionsResult = {
  options: Option[];
  needsInput?: boolean;
  dependsOn?: string[];
};

/**
 * A small guided control inside the conversation. All actual edits go through
 * /draft/edit (which checks schema, permissions, dependencies and live options).
 * No new AI tool, no auto-approval and no database persistence.
 */
export function GuidedNextStep({
  draft,
  sessionId,
  disabled,
  onChange,
  onOpenDraft,
}: {
  draft: RequestDraft;
  sessionId?: string;
  disabled: boolean;
  onChange: (next: RequestDraft, review: DraftReview | null) => void;
  onOpenDraft: () => void;
}) {
  const discovery = useApi(discoveryApiRef),
    api = useApi(fetchApiRef);
  const progress = getDraftProgress(draft);
  const field = progress.next;
  const [raw, setRaw] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isDynamic = field?.uiField === 'DynamicSelect';
  // Only changes to live parent values should trigger a new option fetch.
  const parents = field?.dependsOn ?? [];
  const depSignature = JSON.stringify(
    parents.map(dep => [dep, draft.values[dep] ?? null]),
  );
  const path = field?.path;

  useEffect(() => {
    setRaw('');
    setError('');
    setOptions([]);
    setLoading(false);
    if (!isDynamic || !path || !sessionId) return;
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const base = await discovery.getBaseUrl('ai-chat');
        const search = new URLSearchParams({ sessionId, fieldName: path });
        const response = await api.fetch(
          `${base}/draft/options?${search.toString()}`,
          { cache: 'no-store' },
        );
        if (!response.ok)
          throw new Error('טעינת האפשרויות נכשלה. נסה שוב דרך הטיוטה.');
        const payload = (await response.json()) as OptionsResult;
        if (payload.needsInput)
          throw new Error('חסרה בחירה קודמת לפני שאפשר למלא את השדה הזה.');
        if (!Array.isArray(payload.options))
          throw new Error('השרת לא החזיר אפשרויות תקינות.');
        const safe: Option[] = payload.options
          .filter(
            option =>
              option &&
              (typeof option.value === 'string' ||
                typeof option.value === 'number') &&
              typeof option.label === 'string',
          )
          .slice(0, 80);
        if (active) setOptions(safe);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'לא ניתן לטעון אפשרויות');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [api, discovery, isDynamic, path, sessionId, depSignature]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!field || !sessionId || saving || loading || disabled) return;
    setSaving(true);
    setError('');
    try {
      let value: DraftValue;
      if (isDynamic) {
        const selected = options.find(option => String(option.value) === raw);
        if (!selected) throw new Error('צריך לבחור אפשרות זמינה');
        value = selected.value;
      } else if (field.enum) {
        const selected = field.enum.find(option => String(option) === raw);
        if (selected === undefined) throw new Error('בחר אפשרות מהרשימה');
        value = selected;
      } else {
        value = parseGuidedInput(field, raw);
      }
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/draft/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, values: { [field.path]: value } }),
      });
      if (!response.ok)
        throw new Error(
          'Backstage דחה את הערך. בדוק שהוא עדיין מותר, או ערוך דרך הטיוטה.',
        );
      const out = (await response.json()) as {
        draft: RequestDraft;
        review?: DraftReview | null;
      };
      if (!out.draft || !out.draft.templateRef)
        throw new Error('השרת החזיר טיוטה לא תקינה');
      onChange(out.draft, out.review ?? null);
      setRaw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן לשמור את הבחירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="platform-ai-guide"
      aria-label="השלמת פרטי בקשה"
      dir="rtl"
    >
      <div className="platform-ai-guide-head">
        <div>
          <span className="platform-ai-guide-eyebrow">REQUEST ASSISTANT</span>
          <strong>{draft.title}</strong>
        </div>
        <span className="platform-ai-guide-count" dir="ltr">
          {progress.completed}/{progress.total}
        </span>
      </div>
      <div
        className="platform-ai-guide-track"
        role="progressbar"
        aria-label="שדות חובה שהושלמו"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, progress.total)}
        aria-valuenow={progress.completed}
      >
        <span
          style={{
            width: `${
              progress.total ? (progress.completed / progress.total) * 100 : 100
            }%`,
          }}
        />
      </div>
      {field ? (
        <form
          onSubmit={event => void submit(event)}
          className="platform-ai-guide-form"
        >
          <label htmlFor="platform-ai-guide-input">
            {field.title} <span>· שדה חובה</span>
          </label>
          {isDynamic || field.enum || field.type === 'boolean' ? (
            <select
              id="platform-ai-guide-input"
              value={raw}
              onChange={event => setRaw(event.target.value)}
              disabled={
                disabled ||
                saving ||
                loading ||
                Boolean(error && isDynamic && !options.length)
              }
            >
              <option value="">
                {loading ? 'טוען אפשרויות…' : 'בחר אפשרות'}
              </option>
              {(isDynamic
                ? options
                : field.enum
                ? field.enum.map(v => ({ value: v, label: String(v) }))
                : [
                    { value: 'true', label: 'כן' },
                    { value: 'false', label: 'לא' },
                  ]
              ).map(option => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="platform-ai-guide-input"
              type={
                field.type === 'integer' || field.type === 'number'
                  ? 'number'
                  : 'text'
              }
              step={
                field.type === 'integer'
                  ? '1'
                  : field.type === 'number'
                  ? 'any'
                  : undefined
              }
              maxLength={field.type === 'string' ? 500 : undefined}
              placeholder={`הזן ${field.title}`}
              value={raw}
              onChange={event => setRaw(event.target.value)}
              disabled={disabled || saving}
            />
          )}
          <div className="platform-ai-guide-actions">
            <button
              className="platform-ai-guide-primary"
              type="submit"
              disabled={
                !raw ||
                disabled ||
                saving ||
                loading ||
                Boolean(isDynamic && error && !options.length)
              }
            >
              {saving ? 'שומר…' : 'שמור והמשך'}
            </button>
            <button type="button" onClick={onOpenDraft}>
              הצג טיוטה מלאה
            </button>
          </div>
          {error && (
            <p className="platform-ai-guide-error" role="alert">
              {error}
            </p>
          )}
          <div className="platform-ai-guide-path" dir="ltr">
            {field.path}
          </div>
        </form>
      ) : (
        <div className="platform-ai-guide-complete">
          {draft.readyForReview ? (
            <>
              <strong>כל שדות החובה מולאו</strong>
              <p>עבור לסקירת הטיוטה. לא נשלחה בקשה ולא הופעל שום שירות.</p>
            </>
          ) : (
            <>
              <strong>
                {progress.blocked
                  ? 'נדרשת השלמת שדות קודמים'
                  : 'נדרשת בדיקה ידנית'}
              </strong>
              <p>
                {draft.issues.length
                  ? draft.issues.join(' · ')
                  : 'לא ניתן להמשיך אוטומטית בשדות הנותרים.'}
              </p>
            </>
          )}
          <button type="button" onClick={onOpenDraft}>
            עבור לטיוטה
          </button>
        </div>
      )}
    </section>
  );
}
