import { KONAMI, advance, isComplete, isTypingTarget } from './konami';

const enter = (keys: readonly string[]) =>
  keys.reduce<string[]>((buf, k) => advance(buf, k), []);

describe('the sequence', () => {
  it('completes on the real thing', () => {
    expect(isComplete(enter(KONAMI))).toBe(true);
  });

  it('does not complete on a prefix', () => {
    expect(isComplete(enter(KONAMI.slice(0, -1)))).toBe(false);
  });

  it('resets on a wrong key', () => {
    const keys = [...KONAMI.slice(0, 5), 'x', ...KONAMI.slice(5)];
    expect(isComplete(enter(keys))).toBe(false);
  });

  it('lets a fresh attempt start on the reset key', () => {
    // Mashing up three times then entering it properly still works.
    expect(isComplete(enter(['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI]))).toBe(
      true,
    );
  });

  it('accepts either case for the letters', () => {
    expect(isComplete(enter([...KONAMI.slice(0, 8), 'B', 'A']))).toBe(true);
  });
});

describe('isTypingTarget', () => {
  it('ignores keys typed into a field', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as HTMLElement)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as HTMLElement)).toBe(true);
    expect(
      isTypingTarget({ tagName: 'DIV', isContentEditable: true } as HTMLElement),
    ).toBe(true);
  });

  it('listens everywhere else', () => {
    expect(isTypingTarget({ tagName: 'BODY' } as HTMLElement)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
