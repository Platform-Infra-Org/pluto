import { useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';

export type DraftValue = string | number | boolean;
export type DraftField = {
  path: string;
  title: string;
  type: string;
  required: boolean;
  uiField?: string;
  dependsOn?: string[];
  enum?: DraftValue[];
  state: 'filled' | 'missing' | 'optional' | 'unsupported';
};
export type RequestDraft = {
  templateRef: string;
  title: string;
  values: Record<string, DraftValue>;
  fields: DraftField[];
  missingFields: string[];
  issues: string[];
  readyForReview: boolean;
  checkedAt: string;
};
export type DraftReview = { fingerprint: string; confirmedAt: string };
export type SubmissionReceipt = {
  taskId: string;
  templateRef: string;
  submittedAt: string;
};
type SubmitPreview = {
  confirmationToken: string;
  expiresInSeconds: number;
  summary: {
    templateRef: string;
    values: Record<string, string>;
    warning: string;
  };
};
export function DraftControls({
  draft,
  review,
  sessionId,
  onChange,
  disabled,
  submissionEnabled,
  submission,
  onSubmission,
}: {
  draft: RequestDraft;
  review: DraftReview | null;
  sessionId?: string;
  onChange: (draft: RequestDraft, review: DraftReview | null) => void;
  disabled: boolean;
  submissionEnabled: boolean;
  submission: SubmissionReceipt | null;
  onSubmission: (result: SubmissionReceipt) => void;
}) {
  const discovery = useApi(discoveryApiRef),
    api = useApi(fetchApiRef);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState<DraftValue>('');
  const [options, setOptions] = useState<
    Array<{ value: string | number; label: string }>
  >([]);
  const [waiting, setWaiting] = useState(false),
    [error, setError] = useState('');
  const [submitPreview, setSubmitPreview] = useState<SubmitPreview | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const selectedField = draft.fields.find(f => f.path === editing);
  const fetching = waiting || disabled;
  const loadOptions = async (field: DraftField) => {
    const base = await discovery.getBaseUrl('ai-chat');
    const params = new URLSearchParams({
      sessionId: sessionId ?? '',
      fieldName: field.path,
    });
    const response = await api.fetch(
      `${base}/draft/options?${params.toString()}`,
    );
    if (!response.ok)
      throw new Error(
        'לא הצלחנו להביא אפשרויות עדכניות. בדוק שהשדות התלויים מולאו.',
      );
    const json: unknown = await response.json();
    const data =
      json && typeof json === 'object'
        ? (json as {
            options?: Array<{ value: string | number; label: string }>;
            needsInput?: boolean;
          })
        : {};
    const opts = Array.isArray(data.options) ? data.options : [];
    if (data.needsInput)
      throw new Error('צריך למלא קודם את שדות הבחירה הקודמים.');
    return opts;
  };
  const startEdit = async (field: DraftField) => {
    if (disabled || !sessionId || field.state === 'unsupported') return;
    setError('');
    setWaiting(true);
    setOptions([]);
    setEditing(null);
    try {
      const opts =
        field.uiField === 'DynamicSelect' ? await loadOptions(field) : [];
      setOptions(opts);
      setValue(
        Object.prototype.hasOwnProperty.call(draft.values, field.path)
          ? draft.values[field.path]
          : field.type === 'boolean'
          ? false
          : '',
      );
      setEditing(field.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת השדה');
    } finally {
      setWaiting(false);
    }
  };
  const save = async (clear = false) => {
    if (!editing || !selectedField || !sessionId || fetching) return;
    setWaiting(true);
    setError('');
    try {
      const field = selectedField;
      let parsed: DraftValue = value;
      if (field.type === 'integer' || field.type === 'number') {
        if (
          value === '' ||
          typeof value === 'boolean' ||
          !Number.isFinite(Number(value))
        )
          throw new Error('יש להזין מספר תקין');
        parsed = Number(value);
      } else if (field.type === 'boolean')
        parsed = value === true || value === 'true';
      else if (typeof value !== 'string') parsed = String(value);
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/draft/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...(clear
            ? { clearFields: [editing] }
            : { values: { [editing]: parsed } }),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 410
            ? 'השיחה פגה. התחל שיחה חדשה.'
            : response.status === 403
            ? 'אין הרשאה ל-Template הזה.'
            : 'הערך לא עבר אימות מול ה-Schema או האפשרויות האמיתיות.',
        );
      const out = (await response.json()) as {
        draft: RequestDraft;
        review: DraftReview | null;
      };
      onChange(out.draft, out.review ?? null);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן לעדכן את הטיוטה');
    } finally {
      setWaiting(false);
    }
  };
  const acknowledge = async () => {
    if (!sessionId || fetching || !draft.readyForReview || review) return;
    setWaiting(true);
    setError('');
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/draft/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok)
        throw new Error('אישור הטיוטה נכשל. ייתכן שהנתונים או ההרשאות השתנו.');
      const out = (await response.json()) as {
        draft: RequestDraft;
        review: DraftReview;
      };
      onChange(out.draft, out.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן לאשר טיוטה');
    } finally {
      setWaiting(false);
    }
  };
  const prepareSubmit = async () => {
    if (!review || !sessionId || fetching || submission || !submissionEnabled)
      return;
    setSubmitting(true);
    setError('');
    setSubmitPreview(null);
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/draft/submit/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!response.ok)
        throw new Error(
          'לא ניתן להכין את הבקשה. ייתכן שההרשאות או האפשרויות השתנו.',
        );
      const out = (await response.json()) as SubmitPreview;
      if (!out.confirmationToken) throw new Error('לא התקבל אישור ראשוני');
      setSubmitPreview(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהכנת ההגשה');
    } finally {
      setSubmitting(false);
    }
  };
  const submit = async () => {
    if (!submitPreview || !sessionId || submitting || !review || submission)
      return;
    setSubmitting(true);
    setError('');
    try {
      const base = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${base}/draft/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          confirmationToken: submitPreview.confirmationToken,
        }),
      });
      if (!response.ok) {
        setSubmitPreview(null);
        throw new Error(
          response.status === 502
            ? 'תוצאת ההגשה לא ודאית. אל תנסה לשלוח שוב; בדוק את משימות Scaffolder.'
            : 'השרת חסם את ההגשה. בדוק הרשאות או אשר טיוטה מחדש.',
        );
      }
      const out = (await response.json()) as { submission: SubmissionReceipt };
      if (typeof out.submission?.taskId !== 'string')
        throw new Error('לא התקבל מספר משימה');
      onSubmission(out.submission);
      setSubmitPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השליחה נכשלה');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="platform-ai-manual">
      {draft.fields.map(field => (
        <div className="platform-ai-draft-field" key={field.path}>
          <div className="platform-ai-draft-field-head">
            <strong>{field.title}</strong>
            <span>
              {field.state === 'filled'
                ? '✓'
                : field.state === 'missing'
                ? 'נדרש'
                : field.state === 'unsupported'
                ? 'ממשק נפרד'
                : 'לא חובה'}
            </span>
          </div>
          <div className="platform-ai-draft-value" dir="auto">
            {Object.prototype.hasOwnProperty.call(draft.values, field.path)
              ? String(draft.values[field.path])
              : '—'}
          </div>
          <small dir="ltr">{field.path}</small>
          {field.state !== 'unsupported' && (
            <button
              type="button"
              className="platform-ai-edit-button"
              disabled={fetching || !sessionId}
              onClick={() => void startEdit(field)}
            >
              ערוך
            </button>
          )}
          {editing === field.path && (
            <div className="platform-ai-edit-form">
              {field.uiField === 'DynamicSelect' || field.enum?.length ? (
                <select
                  aria-label={`בחירה: ${field.title}`}
                  value={String(value)}
                  onChange={e => {
                    const list =
                      field.uiField === 'DynamicSelect'
                        ? options
                        : (field.enum ?? []).map(v => ({
                            value: v,
                            label: String(v),
                          }));
                    const next = list.find(
                      x => String(x.value) === e.target.value,
                    );
                    if (next) setValue(next.value);
                  }}
                >
                  <option value="">בחר אפשרות</option>
                  {(field.uiField === 'DynamicSelect'
                    ? options
                    : (field.enum ?? []).map(v => ({
                        value: v,
                        label: String(v),
                      }))
                  ).map(o => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'boolean' ? (
                <select
                  aria-label={`ערך: ${field.title}`}
                  value={String(value)}
                  onChange={e => setValue(e.target.value === 'true')}
                >
                  <option value="false">לא</option>
                  <option value="true">כן</option>
                </select>
              ) : (
                <input
                  aria-label={`ערך: ${field.title}`}
                  type={
                    field.type === 'integer' || field.type === 'number'
                      ? 'number'
                      : 'text'
                  }
                  step={field.type === 'integer' ? '1' : 'any'}
                  value={String(value)}
                  onChange={e => setValue(e.target.value)}
                />
              )}
              <div className="platform-ai-edit-actions">
                <button
                  type="button"
                  disabled={waiting || value === ''}
                  onClick={() => void save()}
                >
                  שמור
                </button>
                {field.state === 'filled' && !field.required && (
                  <button
                    type="button"
                    disabled={waiting}
                    onClick={() => void save(true)}
                  >
                    נקה
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={waiting}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p className="platform-ai-edit-error" role="alert">
          {error}
        </p>
      )}
      {draft.missingFields.length > 0 && (
        <div className="platform-ai-draft-summary">
          <b>מה עוד חסר?</b>
          <p>{draft.missingFields.join(' · ')}</p>
        </div>
      )}
      {draft.issues.length > 0 && (
        <div className="platform-ai-draft-warning">
          <b>דורש טיפול נוסף</b>
          <p>{draft.issues.join(' · ')}</p>
        </div>
      )}
      {draft.readyForReview && (
        <div className="platform-ai-draft-summary">
          <b>כל שדות החובה הנתמכים מולאו.</b>
          <p>נדרשת סקירה שלך. זאת לא הרשאת הגשה.</p>
        </div>
      )}
      {review ? (
        <div className="platform-ai-review-done" role="status">
          ✓ פרטי הטיוטה נבדקו ואושרו ב־
          {new Date(review.confirmedAt).toLocaleString('he-IL')}.
        </div>
      ) : (
        <button
          type="button"
          className="platform-ai-review-button"
          disabled={!draft.readyForReview || !sessionId || fetching}
          onClick={() => void acknowledge()}
        >
          אשר טיוטה לסקירה בלבד
        </button>
      )}
      {submission ? (
        <div className="platform-ai-submission-success" role="status">
          <b>✓ נוצרה משימת Scaffolder</b>
          <p>
            המשימה מפעילה את תהליך פתיחת הבקשה לאישור. אין משמעות הדבר שהמשאב
            הוקם.
          </p>
          <a href={`/create/tasks/${encodeURIComponent(submission.taskId)}`}>
            צפה במשימת Scaffolder
          </a>
          <div className="platform-ai-task-id" dir="ltr">
            {submission.taskId}
          </div>
        </div>
      ) : review &&
        submissionEnabled &&
        draft.templateRef === 'template:default/demo-resource' ? (
        <>
          {!submitPreview ? (
            <button
              type="button"
              className="platform-ai-submit-request"
              disabled={fetching || submitting}
              onClick={() => void prepareSubmit()}
            >
              שלח בקשה למנגנון האישורים
            </button>
          ) : (
            <div
              className="platform-ai-inline-confirm"
              role="group"
              aria-label="אישור שליחת בקשה"
            >
              <b>אישור סופי — יצירת בקשה</b>
              <p>
                תיווצר משימת Scaffolder שתפתח Request במצב PENDING_APPROVAL.
                המשאב לא יוקם עד לאישור הרגיל.
              </p>
              <p dir="ltr">
                {Object.entries(submitPreview.summary.values)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
              <div className="platform-ai-edit-actions">
                <button
                  type="button"
                  disabled={submitting || fetching}
                  onClick={() => void submit()}
                >
                  אני מאשר לשלוח
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setSubmitPreview(null)}
                >
                  חזור
                </button>
              </div>
            </div>
          )}
        </>
      ) : review && !submissionEnabled ? (
        <p className="platform-ai-draft-no-submit">
          שליחת בקשות כבויה בשרת. אפשר לסקור ולערוך טיוטות בלבד.
        </p>
      ) : null}
    </div>
  );
}
