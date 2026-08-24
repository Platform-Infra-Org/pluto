import { CSSProperties, useEffect, useState } from 'react';
import { BOONS, BOON_LABELS, Boon, toBoon } from './hades';
import { applyBoon, applyScheme } from './SchemeRoot';
import { Card, PixelSprite } from './components';
import { BOON_SPRITES } from './sprites';

/**
 * The boon wheel: nine gods around the Hades emblem.
 *
 * Picking sets the scheme AND the boon, so "pick a symbol and the theme
 * changes" holds from any starting potion rather than only from Hades — see
 * `pick` below.
 *
 * Laid out on a circle with transforms rather than nine hand-placed offsets:
 * the ring is one formula (`hadesCss`'s `.sc-boon` rule), and adding or
 * removing a god is a row in `BOONS`.
 */
export function BoonPicker() {
  const [boon, setBoon] = useState<Boon | undefined>(() =>
    toBoon(localStorage.getItem('platform-boon')),
  );
  const [flaring, setFlaring] = useState(false);

  // The one restore point for the persisted boon: reads localStorage fresh on
  // every mount and validates through `toBoon`, rather than trusting a
  // module-load side effect that only ever runs once per process and cannot
  // see a value written after that — see the note in SchemeRoot.tsx. A
  // corrupted or hand-edited value degrades to no boon instead of being
  // written straight through to `data-boon`.
  useEffect(() => {
    applyBoon(toBoon(localStorage.getItem('platform-boon')));
  }, []);

  const pick = (b: Boon) => {
    applyScheme('hades');
    applyBoon(b);
    setBoon(b);
    setFlaring(true);
  };

  return (
    <Card>
      <div className="sc-card-h">
        <div className="sc-card-title">Boons</div>
      </div>
      <div className="sc-card-b">
        <div
          className={`sc-boon-wheel${flaring ? ' sc-boon-flare' : ''}`}
          onAnimationEnd={() => setFlaring(false)}
        >
          {BOONS.map((b, i) => (
            <button
              key={b}
              type="button"
              className="sc-boon"
              aria-pressed={boon === b}
              aria-label={BOON_LABELS[b]}
              style={{ '--i': i, '--n': BOONS.length } as CSSProperties}
              onClick={() => pick(b)}
            >
              <PixelSprite sprite={BOON_SPRITES[b]} />
            </button>
          ))}
        </div>
        {/* The equipped god in text: with motion off, the flare and the
            ornament are gone and this is what still says which one is on. */}
        <div className="sc-muted">
          {boon ? BOON_LABELS[boon] : 'No boon — the house of Hades'}
        </div>
      </div>
    </Card>
  );
}
