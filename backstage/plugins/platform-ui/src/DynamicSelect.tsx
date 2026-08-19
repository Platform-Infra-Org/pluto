import { useEffect, useRef, useState } from 'react';

export interface ChoiceOption {
  label: string;
  value: string;
}

/**
 * Normalize an API response into choice options.
 * - a JSON list `["a","b"]` -> options where label == value
 * - a JSON map `{ "Alias A": "v1" }` -> options where label = key (alias), value = the value
 */
export function toChoiceOptions(data: unknown): ChoiceOption[] {
  if (Array.isArray(data)) {
    return data.map(v => ({ label: String(v), value: String(v) }));
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([k, v]) => ({
      label: k,
      value: String(v),
    }));
  }
  return [];
}

export type Fetcher = (url: string, signal: AbortSignal) => Promise<Response>;
const defaultFetcher: Fetcher = (url, signal) => fetch(url, { signal });

export interface DynamicSelectProps {
  /** Endpoint returning a JSON list or map of options. */
  url: string;
  /**
   * Pre-resolved options. When given, nothing is fetched — the caller already
   * has the data (e.g. a cascade that resolved this level from a tree it holds).
   * `url` is still required so the component keeps one shape.
   */
  options?: ChoiceOption[];
  /** Poll interval in ms. Omit or <= 0 to fetch once (no polling). */
  intervalMs?: number;
  value?: string;
  onChange?: (value: string) => void;
  /** Custom fetch (e.g. Backstage fetchApi for auth/proxy). Defaults to `fetch`. */
  fetcher?: Fetcher;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Called whenever fresh options arrive (e.g. to keep a form's default valid). */
  onOptions?: (options: ChoiceOption[]) => void;
}

/**
 * A shadcn choice box whose options come from an API polled every `intervalMs`.
 * The selection is preserved across refreshes; refresh errors keep the last
 * good options and surface a subtle indicator.
 */
export function DynamicSelect({
  url,
  options: givenOptions,
  intervalMs,
  value,
  onChange,
  fetcher = defaultFetcher,
  placeholder = 'Select…',
  disabled,
  className = '',
  onOptions,
}: DynamicSelectProps) {
  const [fetched, setFetched] = useState<ChoiceOption[]>([]);
  const options = givenOptions ?? fetched;
  const [loading, setLoading] = useState(!givenOptions);
  const [error, setError] = useState<string>();

  // Keep the latest callbacks/fetcher in refs so an inline function identity
  // doesn't restart the polling effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onOptionsRef = useRef(onOptions);
  onOptionsRef.current = onOptions;

  useEffect(() => {
    if (givenOptions) return undefined;
    let cancelled = false;
    let controller: AbortController | undefined;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetcherRef.current(url, controller.signal);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
        const next = toChoiceOptions(await res.json());
        if (cancelled) return;
        setFetched(next);
        setError(undefined);
        setLoading(false);
        onOptionsRef.current?.(next);
      } catch (e) {
        if (cancelled || (e as { name?: string })?.name === 'AbortError') return;
        setError(String((e as Error)?.message ?? e));
        setLoading(false);
      }
    };

    load();
    const id =
      intervalMs && intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      cancelled = true;
      controller?.abort();
      if (id) clearInterval(id);
    };
  }, [url, intervalMs, givenOptions]);

  const showError = !!error && options.length === 0;
  let placeholderText = placeholder;
  if (loading && options.length === 0) placeholderText = 'Loading…';
  else if (showError) placeholderText = 'Failed to load';

  return (
    <div className={`sc ${className}`}>
      <select
        className="sc-select"
        value={value ?? ''}
        disabled={disabled || (loading && options.length === 0)}
        onChange={e => onChange?.(e.target.value)}
      >
        <option value="" disabled>
          {placeholderText}
        </option>
        {options.map(o => (
          <option key={`${o.value}::${o.label}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <div
          className="sc-muted"
          style={{ fontSize: 12, marginTop: 4, color: 'hsl(var(--sc-destructive))' }}
        >
          {showError ? `Could not load options: ${error}` : `Refresh failed (showing last values)`}
        </div>
      )}
    </div>
  );
}
