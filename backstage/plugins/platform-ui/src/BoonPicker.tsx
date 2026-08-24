import { CSSProperties, useState } from 'react';
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

  // No mount-time restore here: SchemeRoot wraps every route and is the one
  // place that actually restores `data-boon` on load (its own useLayoutEffect,
  // regardless of whether this card is even in the configured home sections).
  // `boon` above is this component's own display state — what to show as
  // pressed and named — read once from the same storage key so it starts in
  // step with whatever SchemeRoot already applied.
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
