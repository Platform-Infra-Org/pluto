import { act, fireEvent, render } from '@testing-library/react';
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
  /* What a browser with nothing stored equips. Looked up rather than assumed to
     be SCHEMES[0]: the default is a named id, and the shelf order is free to
     change without these tests going red for the wrong reason. */
  const fallback = SCHEMES.find(s => s.id === 'obsidian') ?? SCHEMES[0];

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
    // The sign-in card's picker, where every bottle is on show and a press is
    // still a plain pick. On the floating shelf the one bottle is the way into
    // the tray instead, which is covered below.
    const { container } = render(<SchemePicker />);
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

  describe('the shelf', () => {
    it('holds only the equipped bottle, and that bottle opens the tray', () => {
      const { container } = render(<SchemePicker floating />);

      const shelf = potions(container);
      expect(shelf).toHaveLength(1);
      // Which one it is, is the point: the equipped one, said in attributes
      // rather than in a glow.
      expect(shelf[0].getAttribute('aria-pressed')).toBe('true');
      expect(shelf[0].getAttribute('aria-label')).toContain(fallback.label);
      expect(shelf[0].getAttribute('aria-expanded')).toBe('false');
      expect(container.querySelector('.sc-picker-inv')).toBeNull();

      fireEvent.click(shelf[0]);

      expect(container.querySelector('.sc-picker-inv')).not.toBeNull();
      expect(potions(container)[0].getAttribute('aria-expanded')).toBe('true');
    });

    it('opens on the first press, not the second', () => {
      // Written with a pointer sequence because a browser sends pointerdown
      // before click and jsdom does not. Seeding the drag position on that
      // pointerdown ran a state update between the two and the re-render
      // swallowed the click, so the first thing pressed after every reload did
      // nothing. Every bare-click test above walked straight past it.
      const { container } = render(<SchemePicker floating />);
      const shelf = container.querySelector('.sc-picker-float')!;

      fireEvent.pointerDown(shelf, {
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerUp(shelf, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.click(potions(container)[0]);

      expect(container.querySelector('.sc-picker-inv')).not.toBeNull();
    });

    it('keeps the sign-in card free of the tray', () => {
      // packages/app/src/modules/auth.tsx mounts a second, non-floating picker
      // inside the card. There the shelf IS every bottle, so there is nothing
      // to open and no control to show.
      const { container } = render(<SchemePicker />);

      expect(container.querySelector('.sc-picker-toggle')).toBeNull();
      expect(container.querySelector('.sc-picker-inv')).toBeNull();
      expect(potions(container)).toHaveLength(SCHEMES.length);
      expect(potions(container)[0].getAttribute('aria-expanded')).toBeNull();
    });

    it('says which potion is equipped without any motion', () => {
      // The sparkles are decoration. Turn every animation off and the shelf
      // still answers the question, from aria-pressed, from the label, and from
      // being one bottle — and the stars are hidden from assistive technology.
      const { container } = render(<SchemePicker floating />);

      const [bottle] = potions(container);
      expect(bottle.getAttribute('aria-pressed')).toBe('true');
      expect(bottle.getAttribute('aria-label')).toContain(fallback.label);

      const stars = Array.from(container.querySelectorAll('.sc-potion-star'));
      expect(stars.length).toBeGreaterThan(0);
      expect(stars.map(st => st.getAttribute('aria-hidden'))).toEqual(
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
      fireEvent.click(view.container.querySelector('.sc-potion')!);
      return view;
    };
    const trayPotions = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('.sc-inv-potion')) as HTMLElement[];

    it('is a tray of bottles and nothing else', () => {
      const { container } = open();
      const tray = trayPotions(container);

      expect(tray).toHaveLength(SCHEMES.length);
      // Each bottle carries its own name, so dropping the label and the Equip
      // button beside it costs nothing a reader or a screen reader needed.
      expect(tray.map(t => t.getAttribute('aria-label'))).toEqual(
        SCHEMES.map(sc => sc.label),
      );
      expect(container.querySelector('.sc-inv-equip')).toBeNull();
      expect(container.querySelector('.sc-inv-name')).toBeNull();
      // Exactly one is equipped, and it says so without relying on its fill.
      expect(
        tray.filter(t => t.getAttribute('aria-pressed') === 'true'),
      ).toHaveLength(1);
    });

    it('casts before it equips, and equips when the cast ends', () => {
      jest.useFakeTimers();
      try {
        const { container } = open();
        const target = trayPotions(container)[3];

        fireEvent.click(target);

        // Mid-cast: the animation is running and nothing has been applied yet.
        expect(
          container.querySelector('.sc-inv-casting'),
        ).not.toBeNull();
        expect(container.querySelectorAll('.sc-cast-star').length).toBeGreaterThan(0);
        expect(localStorage.getItem('platform-scheme')).not.toBe(SCHEMES[3].id);

        act(() => {
          jest.advanceTimersByTime(400);
        });

        expect(localStorage.getItem('platform-scheme')).toBe(SCHEMES[3].id);
        expect(container.querySelector('.sc-inv-casting')).toBeNull();
        // Picking closes the tray, and the shelf now holds the new bottle.
        expect(container.querySelector('.sc-picker-inv')).toBeNull();
        expect(potions(container)[0].getAttribute('aria-label')).toContain(
          SCHEMES[3].label,
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('equips at once for a reader who asked for less motion', () => {
      // The wait exists only to let the cast play. Holding a colour back for
      // 360ms of animation nobody will see is a worse experience, not a
      // gentler one.
      const mm = jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      });
      (window as unknown as { matchMedia: unknown }).matchMedia = mm;
      jest.useFakeTimers();
      try {
        const { container } = open();
        fireEvent.click(trayPotions(container)[2]);

        // No timer advanced: it is already applied.
        expect(localStorage.getItem('platform-scheme')).toBe(SCHEMES[2].id);
        expect(container.querySelector('.sc-inv-casting')).toBeNull();
      } finally {
        jest.useRealTimers();
        delete (window as unknown as { matchMedia?: unknown }).matchMedia;
      }
    });

    it('closes on Escape and hands focus back to the bottle that opened it', () => {
      const { container } = open();
      expect(container.querySelector('.sc-picker-inv')).not.toBeNull();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(container.querySelector('.sc-picker-inv')).toBeNull();
      expect(document.activeElement).toBe(potions(container)[0]);
    });
  });
});
