import { fireEvent, render } from '@testing-library/react';
import { SchemePicker } from './SchemeRoot';

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

  it('is inline-positioned before the first move, so it cannot snap', () => {
    // The corner anchors are dropped by a CSS attribute written imperatively,
    // while the inline left/top arrive in React's next commit. Flipping them
    // when the drag threshold was crossed left one frame with neither, and the
    // box snapped to static flow and back. Both must land together, on press.
    delete document.documentElement.dataset.pickerMoved;
    const { container } = render(<SchemePicker floating />);
    const shelf = container.querySelector('.sc-picker-float') as HTMLElement;
    expect(document.documentElement.dataset.pickerMoved).toBeUndefined();
    expect(shelf.style.left).toBe('');

    fireEvent.pointerDown(shelf, {
      button: 0,
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    expect(document.documentElement.dataset.pickerMoved).toBe('true');
    expect(shelf.style.left).not.toBe('');
    expect(shelf.style.top).not.toBe('');
    // A press alone is not a drag, so nothing may be captured yet.
    expect(capture).not.toHaveBeenCalled();
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
});
