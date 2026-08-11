import { useState } from 'react';
import { Select } from './components';
import type { Direction } from './graph/graphUrlState';

export const DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> = [
  { value: 'LR', label: 'Left to right' },
  { value: 'RL', label: 'Right to left' },
  { value: 'TB', label: 'Top to bottom' },
  { value: 'BT', label: 'Bottom to top' },
];

/**
 * The layout-direction control shared by every graph.
 *
 * Sits in a card header opposite the title, which is where every graph on this
 * app lives — they are cards, not pages, so the choice is component state
 * rather than a URL parameter.
 */
export function GraphDirectionPicker({
  value,
  onChange,
  id,
}: {
  value: Direction;
  onChange: (next: Direction) => void;
  /** Distinguishes the control when two graphs share a page. */
  id?: string;
}) {
  return (
    <Select
      id={id}
      aria-label="Graph direction"
      className="sc-select sc-select-sm"
      value={value}
      onChange={e => onChange(e.target.value as Direction)}
    >
      {DIRECTION_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Remembers the direction per graph, so it survives a remount. */
export function useGraphDirection(storageKey: string, fallback: Direction = 'LR') {
  const [direction, setDirection] = useState<Direction>(() => {
    if (typeof localStorage === 'undefined') return fallback;
    const stored = localStorage.getItem(storageKey);
    return DIRECTION_OPTIONS.some(o => o.value === stored)
      ? (stored as Direction)
      : fallback;
  });
  const set = (next: Direction) => {
    setDirection(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore a full or blocked store */
    }
  };
  return [direction, set] as const;
}
