import { fireEvent, render } from '@testing-library/react';
import { SchemePicker, SCHEMES } from './SchemeRoot';

/**
 * The picker is a row of buttons that is also draggable, and those two jobs
 * compete for the same press.
 *
 * The regression these guard: capturing the pointer on `pointerdown` retargets
 * the following `click` to the capturing element, so every potion's click went
 * to the container instead of the button and the colour could not be changed at
 * all. Only the floating instance had pointer handlers, which is why the
 * sign-in card's picker kept working and hid the breakage.
 */
describe('SchemePicker', () => {
  let capture: jest.Mock;
  let release: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    capture = jest.fn();
    release = jest.fn();
    // jsdom implements neither; the component calls both.
    (
      Element.prototype as unknown as { setPointerCapture: unknown }
    ).setPointerCapture = capture;
    (
      Element.prototype as unknown as { releasePointerCapture: unknown }
    ).releasePointerCapture = release;
  });

  const potions = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('.sc-potion')) as HTMLElement[];

  it('does not capture the pointer on a press that never moves', () => {
    const { container } = render(<SchemePicker floating />);
    const shelf = container.querySelector('.sc-picker-float')!;

    fireEvent.pointerDown(shelf, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(shelf, { pointerId: 1, clientX: 10, clientY: 10 });

    // Capturing here is what stole the click from the buttons.
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures once the press becomes a drag', () => {
    const { container } = render(<SchemePicker floating />);
    const shelf = container.querySelector('.sc-picker-float')!;

    fireEvent.pointerDown(shelf, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    // buttons: 1 is what a real drag sends; jsdom defaults it to 0, which the
    // component now correctly treats as a hover.
    fireEvent.pointerMove(shelf, { pointerId: 1, clientX: 40, clientY: 40, buttons: 1 });

    expect(capture).toHaveBeenCalledWith(1);
  });

  it('changes the scheme when a potion is clicked', () => {
    const { container } = render(<SchemePicker floating />);
    const [, second] = potions(container);

    fireEvent.click(second);

    expect(second.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('platform-scheme')).toBeTruthy();
  });

  it('leaves the sign-in card instance undraggable', () => {
    const { container } = render(<SchemePicker />);
    const shelf = container.querySelector('.sc-picker')!;
    expect(shelf.classList.contains('sc-picker-float')).toBe(false);

    fireEvent.pointerDown(shelf, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(shelf, { pointerId: 1, clientX: 90, clientY: 90, buttons: 1 });

    // No capture, no inline position: in the flow of the card, it does not move.
    expect(capture).not.toHaveBeenCalled();
    expect((shelf as HTMLElement).style.left).toBe('');
  });

  it('never drops the corner anchor without an inline position to replace it', () => {
    // The invariant, not the mechanism. The corner anchors are dropped by a CSS
    // attribute, and the inline left/top arrive in a React commit; a frame with
    // the attribute set and no position left the box snapping to static flow
    // and back. They must never be out of step in that direction.
    //
    // This used to be satisfied by seeding both on the press, which cost the
    // first click after every reload — the state update landed between
    // pointerdown and click and the re-render swallowed it. Now neither lands
    // on a press, and both land when the press becomes a drag: setPos commits,
    // and the effect on `pos` sets the attribute after that commit. The
    // invariant holds at both ends, so it is asserted at both ends.
    delete document.documentElement.dataset.pickerMoved;
    const { container } = render(<SchemePicker floating />);
    const shelf = container.querySelector('.sc-picker-float') as HTMLElement;
    expect(document.documentElement.dataset.pickerMoved).toBeUndefined();
    expect(shelf.style.left).toBe('');

    // A press alone is not a drag: the box stays corner-anchored, so there is
    // nothing to snap and nothing may be captured yet.
    fireEvent.pointerDown(shelf, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    expect(document.documentElement.dataset.pickerMoved).toBeUndefined();
    expect(shelf.style.left).toBe('');
    expect(capture).not.toHaveBeenCalled();

    // Crossing the threshold makes it a drag, and now both land together.
    fireEvent.pointerMove(shelf, {
      pointerId: 1,
      clientX: 200,
      clientY: 200,
      buttons: 1,
    });
    expect(shelf.style.left).not.toBe('');
    expect(shelf.style.top).not.toBe('');
    expect(document.documentElement.dataset.pickerMoved).toBe('true');
  });

  it('ignores a move with no button held, and forgets the stale press', () => {
    // pointerup/pointercancel are bound to the element, so a press that starts
    // on the shelf and releases somewhere else never reaches endDrag. The
    // bookkeeping used to survive that, and every later hover then moved the
    // shelf as though the drag had never ended.
    delete document.documentElement.dataset.pickerMoved;
    const { container } = render(<SchemePicker floating />);
    const shelf = container.querySelector('.sc-picker-float') as HTMLElement;

    fireEvent.pointerDown(shelf, { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
    const seeded = shelf.style.left;

    // A hover: far enough to clear the drag threshold, but no button down.
    fireEvent.pointerMove(shelf, { pointerId: 1, clientX: 400, clientY: 400, buttons: 0 });
    expect(shelf.style.left).toBe(seeded);
    expect(shelf.getAttribute('data-dragging')).toBeNull();
    expect(capture).not.toHaveBeenCalled();

    // And the press is forgotten, so a second hover cannot move it either.
    fireEvent.pointerMove(shelf, { pointerId: 1, clientX: 700, clientY: 700, buttons: 0 });
    expect(shelf.style.left).toBe(seeded);
  });

  describe('collapsing the shelf', () => {
    it('closes down to the one bottle that is equipped', () => {
      const { container, getByLabelText } = render(<SchemePicker floating />);
      expect(potions(container)).toHaveLength(SCHEMES.length);

      fireEvent.click(getByLabelText('Hide potions'));

      const left = potions(container);
      expect(left).toHaveLength(1);
      // Which one survived is the whole point: it is the equipped one, and it
      // says so in attributes rather than in a glow.
      expect(left[0].getAttribute('aria-pressed')).toBe('true');
      expect(left[0].getAttribute('aria-label')).toBe(SCHEMES[0].label);
      expect(localStorage.getItem('platform-picker-collapsed')).toBe('1');
    });

    it('closes on the first press, not the second', () => {
      // The real regression, and the reason it is written with a pointer
      // sequence: a browser sends pointerdown before click, jsdom does not.
      // Seeding the drag position on that pointerdown ran a state update
      // between the two, and the re-render swallowed the click — so on a shelf
      // that had never been dragged, the first thing a user clicked after every
      // reload did nothing and only the second press worked. Every test above
      // fires a bare click and so could not see it.
      const { container, getByLabelText } = render(<SchemePicker floating />);
      const shelf = container.querySelector('.sc-picker-float')!;
      const toggle = getByLabelText('Hide potions');

      fireEvent.pointerDown(shelf, {
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerUp(shelf, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.click(toggle);

      expect(potions(container)).toHaveLength(1);
      expect(localStorage.getItem('platform-picker-collapsed')).toBe('1');
    });

    it('comes back closed', () => {
      localStorage.setItem('platform-picker-collapsed', '1');
      const { container } = render(<SchemePicker floating />);

      expect(potions(container)).toHaveLength(1);
      expect(
        container.querySelector('.sc-picker')!.classList.contains('sc-picker-collapsed'),
      ).toBe(true);
    });

    it('keeps the sign-in card free of both controls', () => {
      // packages/app/src/modules/auth.tsx mounts a second, non-floating picker
      // inside the card. Neither the fold nor the inventory belongs there, and
      // a persisted collapse must not reach it either.
      localStorage.setItem('platform-picker-collapsed', '1');
      const { container } = render(<SchemePicker />);

      expect(container.querySelector('.sc-picker-toggle')).toBeNull();
      expect(container.querySelector('.sc-picker-inv')).toBeNull();
      expect(potions(container)).toHaveLength(SCHEMES.length);
    });

    it('says which potion is equipped without any motion', () => {
      // The sparkles are decoration. Turn every animation off and the closed
      // shelf still answers the question, from aria-pressed, from the label,
      // and from being one bottle — and the stars themselves are hidden from
      // assistive technology entirely.
      const { container, getByLabelText } = render(<SchemePicker floating />);
      fireEvent.click(getByLabelText('Hide potions'));

      const [bottle] = potions(container);
      expect(bottle.getAttribute('aria-pressed')).toBe('true');
      expect(bottle.getAttribute('aria-label')).toBe(SCHEMES[0].label);

      const stars = Array.from(container.querySelectorAll('.sc-potion-star'));
      expect(stars.length).toBeGreaterThan(0);
      expect(stars.map(s => s.getAttribute('aria-hidden'))).toEqual(
        stars.map(() => 'true'),
      );
      expect(
        container.querySelector('.sc-potion-stars')!.getAttribute('aria-hidden'),
      ).toBe('true');
    });
  });

  describe('the inventory', () => {
    const open = () => {
      const view = render(<SchemePicker floating />);
      fireEvent.click(view.getByLabelText('Potion inventory'));
      return view;
    };

    it('lists every equippable potion, each with its own action', () => {
      const { container } = open();
      const rows = Array.from(container.querySelectorAll('.sc-inv-row'));

      expect(rows).toHaveLength(SCHEMES.length);
      expect(rows.map(r => r.querySelector('.sc-inv-name')!.textContent)).toEqual(
        SCHEMES.map(s => s.label),
      );
      expect(rows.filter(r => r.querySelector('.sc-inv-equip'))).toHaveLength(
        SCHEMES.length,
      );
    });

    it('equips the potion whose row was actioned', () => {
      const { container } = open();
      const row = Array.from(container.querySelectorAll('.sc-inv-row'))[3];
      const equip = row.querySelector('.sc-inv-equip') as HTMLElement;
      expect(equip.textContent).toBe('Equip');

      fireEvent.click(equip);

      expect(localStorage.getItem('platform-scheme')).toBe(SCHEMES[3].id);
      // Readable as words, not only as a fill colour.
      expect(equip.textContent).toBe('Equipped');
      expect(equip.getAttribute('aria-pressed')).toBe('true');
      const pressed = potions(container).filter(
        p => p.getAttribute('aria-pressed') === 'true',
      );
      expect(pressed.map(p => p.getAttribute('aria-label'))).toEqual([
        SCHEMES[3].label,
      ]);
    });

    it('closes on Escape and hands focus back to the control that opened it', () => {
      const { container, getByLabelText } = open();
      const panel = container.querySelector('.sc-picker-inv')!;

      fireEvent.keyDown(panel, { key: 'Escape' });

      expect(container.querySelector('.sc-picker-inv')).toBeNull();
      expect(document.activeElement).toBe(getByLabelText('Potion inventory'));
    });
  });
});
