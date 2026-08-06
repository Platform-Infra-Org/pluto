/** Up up down down left right left right B A. */
export const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

/**
 * The last N keys pressed, newest last, lowercased.
 *
 * A buffer rather than a match counter: a counter cannot express overlap. After
 * up-up-up a counter has to guess whether it is 1 or 2 keys into the sequence,
 * and either answer is wrong for some input — the last two keys really are a
 * valid prefix. Keeping the last ten keys and comparing makes every case fall
 * out for free.
 */
export function advance(buffer: readonly string[], key: string): string[] {
  return [...buffer, key.toLowerCase()].slice(-KONAMI.length);
}

/** True once the buffer is exactly the sequence. */
export function isComplete(buffer: readonly string[]): boolean {
  return (
    buffer.length === KONAMI.length &&
    buffer.every((k, i) => k === KONAMI[i].toLowerCase())
  );
}

/**
 * Typing must never trigger it: b and a are ordinary letters, and someone
 * writing "banana" in an approval note is not asking for anything.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
}

/**
 * Listen for the sequence and run `onComplete`. Returns the detach function.
 *
 * Nothing is stored and nothing is announced: it resets on reload, which is the
 * whole point of an easter egg.
 */
export function listenForKonami(onComplete: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  let buffer: string[] = [];
  const onKey = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    buffer = advance(buffer, e.key);
    if (isComplete(buffer)) {
      buffer = [];
      onComplete();
    }
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
