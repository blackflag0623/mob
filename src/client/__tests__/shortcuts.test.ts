import { describe, it, expect } from 'vitest';
import { parseShortcut, matchesShortcut, eventToShortcut, formatShortcut } from '../lib/shortcuts.js';

function mockEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    code: '',
    key: '',
    ...overrides,
  } as KeyboardEvent;
}

describe('parseShortcut', () => {
  it('parses Alt+KeyN', () => {
    expect(parseShortcut('Alt+KeyN')).toEqual({
      alt: true, ctrl: false, meta: false, shift: false, code: 'KeyN',
    });
  });

  it('parses Ctrl+Shift+KeyA', () => {
    expect(parseShortcut('Ctrl+Shift+KeyA')).toEqual({
      alt: false, ctrl: true, meta: false, shift: true, code: 'KeyA',
    });
  });

  it('parses bare KeyX', () => {
    expect(parseShortcut('KeyX')).toEqual({
      alt: false, ctrl: false, meta: false, shift: false, code: 'KeyX',
    });
  });

  it('parses Mod+KeyS with no modifier flags', () => {
    // Mod is not alt/ctrl/meta/shift — handled in matchesShortcut
    const result = parseShortcut('Mod+KeyS');
    expect(result.alt).toBe(false);
    expect(result.ctrl).toBe(false);
    expect(result.meta).toBe(false);
    expect(result.shift).toBe(false);
    expect(result.code).toBe('KeyS');
  });
});

describe('matchesShortcut', () => {
  it('Alt+KeyN matches event with altKey=true', () => {
    const event = mockEvent({ altKey: true, code: 'KeyN', key: 'n' });
    expect(matchesShortcut(event, 'Alt+KeyN', false)).toBe(true);
  });

  it('Alt+KeyN does NOT match event with altKey=false', () => {
    const event = mockEvent({ altKey: false, code: 'KeyN', key: 'n' });
    expect(matchesShortcut(event, 'Alt+KeyN', false)).toBe(false);
  });

  it('Mod+KeyS on Mac matches metaKey=true', () => {
    const event = mockEvent({ metaKey: true, code: 'KeyS', key: 's' });
    expect(matchesShortcut(event, 'Mod+KeyS', true)).toBe(true);
  });

  it('Mod+KeyS on non-Mac matches ctrlKey=true', () => {
    const event = mockEvent({ ctrlKey: true, code: 'KeyS', key: 's' });
    expect(matchesShortcut(event, 'Mod+KeyS', false)).toBe(true);
  });

  it('Mod+KeyS on Mac does NOT match if ctrlKey is also true', () => {
    const event = mockEvent({ metaKey: true, ctrlKey: true, code: 'KeyS', key: 's' });
    expect(matchesShortcut(event, 'Mod+KeyS', true)).toBe(false);
  });

  it('arrow key matching uses event.key', () => {
    const event = mockEvent({ altKey: true, key: 'ArrowUp', code: 'ArrowUp' });
    expect(matchesShortcut(event, 'Alt+ArrowUp', false)).toBe(true);
  });
});

describe('eventToShortcut', () => {
  it('ctrlKey on non-Mac → Mod+', () => {
    const event = mockEvent({ ctrlKey: true, code: 'KeyA', key: 'a' });
    expect(eventToShortcut(event, false)).toBe('Mod+KeyA');
  });

  it('metaKey on Mac → Mod+', () => {
    const event = mockEvent({ metaKey: true, code: 'KeyA', key: 'a' });
    expect(eventToShortcut(event, true)).toBe('Mod+KeyA');
  });

  it('bare modifier key returns empty string', () => {
    const event = mockEvent({ ctrlKey: true, code: 'ControlLeft', key: 'Control' });
    expect(eventToShortcut(event, false)).toBe('');
  });

  it('multiple modifiers in correct order', () => {
    const event = mockEvent({ ctrlKey: true, altKey: true, code: 'KeyA', key: 'a' });
    expect(eventToShortcut(event, false)).toBe('Mod+Alt+KeyA');
  });
});

describe('formatShortcut', () => {
  it('Mod+KeyA on Mac → Cmd+A', () => {
    expect(formatShortcut('Mod+KeyA', true)).toBe('Cmd+A');
  });

  it('Mod+KeyA on non-Mac → Ctrl+A', () => {
    expect(formatShortcut('Mod+KeyA', false)).toBe('Ctrl+A');
  });

  it('Alt+Digit1 on Mac → Option+1', () => {
    expect(formatShortcut('Alt+Digit1', true)).toBe('Option+1');
  });

  it('Alt+ArrowUp → Alt+Up', () => {
    expect(formatShortcut('Alt+ArrowUp', false)).toBe('Alt+Up');
  });
});
