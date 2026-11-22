import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import './chat.css';
import {
  DraftControls,
  type RequestDraft,
  type DraftReview,
  type SubmissionReceipt,
} from './DraftControls';
import { GuidedNextStep } from './GuidedNextStep';
import { PlatformBrandTile } from './PlatformBrandTile';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
};
type Reply = {
  reply: string;
  sessionId: string;
  toolsUsed: string[];
  draft?: RequestDraft | null;
  review?: DraftReview | null;
};

// A minimal, safe formatter. Text stays escaped by React; no HTML injection,
// Markdown libraries or dangerouslySetInnerHTML required.
function inlineParts(line: string, seed: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let start = 0,
    match: RegExpExecArray | null,
    index = 0;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > start) pieces.push(line.slice(start, match.index));
    const chunk = match[0];
    pieces.push(
      chunk.startsWith('**') ? (
        <strong key={`${seed}-${index}`}>{chunk.slice(2, -2)}</strong>
      ) : (
        <code key={`${seed}-${index}`} dir="auto">
          {chunk.slice(1, -1)}
        </code>
      ),
    );
    start = regex.lastIndex;
    index++;
  }
  if (start < line.length) pieces.push(line.slice(start));
  return pieces;
}
function MessageBody({ text }: { text: string }) {
  return (
    <div className="platform-ai-prose">
      {text.split(/\r?\n/).map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed)
          return <div key={`gap-${i}`} className="platform-ai-paragraph-gap" />;
        const bullet = /^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);
        const clean = bullet
          ? trimmed.replace(/^(?:[-*]|\d+[.)])\s+/, '')
          : trimmed;
        return (
          <div
            key={i}
            className={`platform-ai-prose-line${bullet ? ' is-bullet' : ''}`}
          >
            {bullet && (
              <span className="platform-ai-list-marker" aria-hidden="true" />
            )}
            {inlineParts(clean, String(i))}
          </div>
        );
      })}
    </div>
  );
}

const suggestions = [
  { name: 'גילוי שירותים', text: 'אילו Templates זמינים לי כרגע? הצג בקצרה.' },
  {
    name: 'טיוטת בקשה',
    text: 'אני רוצה Demo Resource בשם test-123. אילו שדות חסרים?',
  },
  {
    name: 'טופס תלוי',
    text: 'אני רוצה טיוטה של coordinate-demo. הצג לי את שדה הבחירה הראשון.',
  },
];

/** Ephemeral in-memory chat: never fetches historical sessions or uses browser storage. */
export function AiChatPage({ compact = false }: { compact?: boolean } = {}) {
  const discovery = useApi(discoveryApiRef),
    api = useApi(fetchApiRef);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePanel, setActivePanel] = useState<'chat' | 'draft'>('chat');
  const [requestDraft, setRequestDraft] = useState<RequestDraft | null>(null);
  const [review, setReview] = useState<DraftReview | null>(null);
  const [submissionEnabled, setSubmissionEnabled] = useState(false);
  const [submission, setSubmission] = useState<SubmissionReceipt | null>(null);
  const [draft, setDraft] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const session = useRef<string | undefined>(undefined);
  const transcript = useRef<HTMLElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (activePanel !== 'chat') return;
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, busy, activePanel]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const endpoint = await discovery.getBaseUrl('ai-chat');
        const response = await api.fetch(`${endpoint}/capabilities`);
        if (response.ok) {
          const json = (await response.json()) as {
            submissionEnabled?: boolean;
          };
          if (active) setSubmissionEnabled(json.submissionEnabled === true);
        }
      } catch {
        /* Fail closed. */
      }
    })();
    return () => {
      active = false;
    };
  }, [api, discovery]);
  const reset = useCallback(() => {
    if (busy) return;
    const oldId = session.current;
    session.current = undefined;
    setMessages([]);
    setActivePanel('chat');
    setDraft('');
    setError('');
    setRequestDraft(null);
    setReview(null);
    setSubmission(null);
    composer.current?.focus();
    // Best-effort immediate deletion of the previous volatile backend session.
    // New chat never waits on the network, never restores it, and never stores
    // history in localStorage/sessionStorage/database.
    if (oldId)
      void (async () => {
        try {
          const base = await discovery.getBaseUrl('ai-chat');
          await api.fetch(`${base}/session/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: oldId }),
          });
        } catch {
          /* Previous session also expires automatically after 30 minutes. */
        }
      })();
  }, [busy, api, discovery]);
  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || busy || submission || message.length > 2000) return;
    setBusy(true);
    setError('');
    setDraft('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    try {
      const endpoint = await discovery.getBaseUrl('ai-chat');
      const response = await api.fetch(`${endpoint}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: session.current }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 410
            ? 'השיחה הזמנית הסתיימה. התחל שיחה חדשה.'
            : `שגיאת תקשורת (HTTP ${response.status})`,
        );
      const payload: Reply = await response.json();
      if (
        !payload ||
        typeof payload.reply !== 'string' ||
        typeof payload.sessionId !== 'string'
      )
        throw new Error('תשובה לא תקינה מהשרת');
      session.current = payload.sessionId;
      setRequestDraft(payload.draft ?? null);
      setReview(payload.review ?? null);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: payload.reply,
          tools: Array.isArray(payload.toolsUsed) ? payload.toolsUsed : [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'לא ניתן לשלוח הודעה');
    } finally {
      setBusy(false);
    }
  }, [draft, busy, submission, discovery, api]);
  const chooseSuggestion = (value: string) => {
    setActivePanel('chat');
    setDraft(value);
    window.requestAnimationFrame(() => composer.current?.focus());
  };
  return (
    <div
      className={`platform-ai${compact ? ' platform-ai-compact' : ''}`}
      dir="rtl"
    >
      <div
        className="platform-ai-view-tabs"
        role="tablist"
        aria-label="תצוגת עוזר"
      >
        <div className="platform-ai-tab-list">
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'chat'}
            className={activePanel === 'chat' ? 'active' : ''}
            onClick={() => setActivePanel('chat')}
          >
            <span>שיחה</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'draft'}
            className={activePanel === 'draft' ? 'active' : ''}
            onClick={() => setActivePanel('draft')}
          >
            <span>טיוטה</span>
            {requestDraft && (
              <span className="platform-ai-tab-dot" aria-label="קיימת טיוטה" />
            )}
          </button>
        </div>
        <button
          type="button"
          className="platform-ai-new-chat"
          aria-label="התחל שיחה חדשה"
          title="שיחה חדשה (מוחקת את השיחה הזמנית)"
          onClick={reset}
          disabled={busy}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>{' '}
          חדשה
        </button>
      </div>
      <div className="platform-ai-context-strip" role="note">
        <span className="platform-ai-context-label">DEMO</span> מידע ציבורי
        לדוגמה בלבד <span aria-hidden="true">·</span>{' '}
        {submissionEnabled ? 'הגשה דרך אישור אנושי' : 'ללא הגשה'}
      </div>
      <div className="platform-ai-workspace">
        <section
          ref={transcript}
          className={`platform-ai-transcript${
            activePanel === 'chat' ? ' is-active' : ''
          }`}
          role="tabpanel"
          aria-label="שיחה"
        >
          {messages.length === 0 && (
            <div className="platform-ai-empty">
              <PlatformBrandTile size="empty" />
              <div className="platform-ai-empty-overline">
                PLATFORM WORKSPACE
              </div>
              <h2>מה בונים היום?</h2>
              <p>
                תאר מה אתה צריך. אמצא את ה־Template המתאים ואעזור לך להשלים את
                הפרטים.
              </p>
              <div
                className="platform-ai-suggestions"
                aria-label="הצעות להתחלה"
              >
                {suggestions.map(x => (
                  <button
                    type="button"
                    key={x.name}
                    className="platform-ai-suggestion"
                    onClick={() => chooseSuggestion(x.text)}
                  >
                    <span>{x.name}</span>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((item, index) => (
            <article
              key={index}
              className={`platform-ai-message platform-ai-${item.role}`}
            >
              {item.role === 'assistant' && <PlatformBrandTile size="avatar" />}
              <div className="platform-ai-message-body">
                <div className="platform-ai-message-name">
                  {item.role === 'assistant' ? 'Platform Assistant' : 'אתה'}
                </div>
                <div className="platform-ai-bubble">
                  <MessageBody text={item.content} />
                </div>
                {Boolean(item.tools?.length) && (
                  <details className="platform-ai-tools">
                    <summary>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>{' '}
                      נבדק מול Backstage
                    </summary>
                    <div dir="ltr">{item.tools?.join(' · ')}</div>
                  </details>
                )}
              </div>
            </article>
          ))}
          {busy && (
            <div className="platform-ai-thinking" role="status">
              <span className="platform-ai-thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>{' '}
              בודק מול Backstage…
            </div>
          )}
          {requestDraft && session.current && !submission && !busy && (
            <GuidedNextStep
              draft={requestDraft}
              sessionId={session.current}
              disabled={busy}
              onOpenDraft={() => setActivePanel('draft')}
              onChange={(next, nextReview) => {
                setRequestDraft(next);
                setReview(nextReview);
              }}
            />
          )}
        </section>
        <section
          className={`platform-ai-draft${
            activePanel === 'draft' ? ' is-active' : ''
          }`}
          role="tabpanel"
          aria-label="טיוטת בקשה"
          aria-live="polite"
        >
          <div className="platform-ai-draft-head">
            <div>
              <span className="platform-ai-draft-eyebrow">REQUEST DETAILS</span>
              <h2>טיוטת הבקשה</h2>
            </div>
            <span
              className={`platform-ai-draft-state${
                requestDraft?.readyForReview ? ' ready' : ''
              }`}
            >
              {requestDraft?.readyForReview ? 'מוכנה לסקירה' : 'בעבודה'}
            </span>
          </div>
          {!requestDraft ? (
            <div className="platform-ai-draft-empty">
              <div className="platform-ai-draft-empty-icon" aria-hidden="true">
                ▤
              </div>
              <strong>עדיין אין טיוטה</strong>
              <p>
                פרטי הבקשה יופיעו כאן אחרי שנבחר Template ונאמת את השדות מול
                Backstage.
              </p>
              <button type="button" onClick={() => setActivePanel('chat')}>
                חזור לשיחה
              </button>
            </div>
          ) : (
            <>
              <div className="platform-ai-template-summary">
                <span>Template</span>
                <strong>{requestDraft.title}</strong>
                <small dir="ltr">{requestDraft.templateRef}</small>
              </div>
              <DraftControls
                key={`${requestDraft.templateRef}:${
                  review?.fingerprint ?? ''
                }:${review?.confirmedAt ?? ''}`}
                draft={requestDraft}
                review={review}
                sessionId={session.current}
                disabled={busy || !!submission}
                submissionEnabled={submissionEnabled}
                submission={submission}
                onSubmission={setSubmission}
                onChange={(next, nextReview) => {
                  setRequestDraft(next);
                  setReview(nextReview);
                }}
              />
            </>
          )}
          <div className="platform-ai-draft-privacy">
            העוזר לא מגיש בקשות בעצמו. פעולות הגשה דורשות אישור שלך.
          </div>
        </section>
      </div>
      {error && (
        <div className="platform-ai-error" role="alert">
          {error}{' '}
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="סגור שגיאה"
          >
            ×
          </button>
        </div>
      )}
      {activePanel === 'chat' && (
        <form
          className="platform-ai-composer"
          onSubmit={event => {
            event.preventDefault();
            void send();
          }}
        >
          <label
            className="platform-ai-composer-label"
            htmlFor="platform-ai-input"
          >
            הודעה חדשה
          </label>
          <div className="platform-ai-input-shell">
            <textarea
              id="platform-ai-input"
              ref={composer}
              rows={2}
              maxLength={2000}
              placeholder="בקש שירות או שאל שאלה…"
              aria-label="כתוב הודעה"
              value={draft}
              disabled={busy || !!submission}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              className="platform-ai-submit"
              aria-label="שלח הודעה"
              disabled={busy || !!submission || !draft.trim()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5m0 0L6 11m6-6 6 6" />
              </svg>
            </button>
          </div>
          <div className="platform-ai-composer-foot">
            <span>Enter לשליחה · Shift + Enter לשורה</span>
            <span>שיחה זמנית בלבד</span>
          </div>
        </form>
      )}
      <div className="platform-ai-bottom-notice">
        לא להזין סודות או מידע תשתיתי פנימי למודל ציבורי.
      </div>
    </div>
  );
}
