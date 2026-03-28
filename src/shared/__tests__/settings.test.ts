import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, DEFAULT_SETTINGS } from '../settings.js';

describe('mergeWithDefaults', () => {
  it('returns defaults for empty object', () => {
    expect(mergeWithDefaults({})).toEqual(DEFAULT_SETTINGS);
  });

  it('overrides a single field', () => {
    const result = mergeWithDefaults({ terminal: { fontSize: 18 } });
    expect(result.terminal.fontSize).toBe(18);
    expect(result.terminal.cursorStyle).toBe('block');
    expect(result.terminal.scrollbackLines).toBe(5000);
  });

  it('ignores unrecognized top-level sections', () => {
    const result = mergeWithDefaults({ unknown: { x: 1 } });
    expect((result as any).unknown).toBeUndefined();
    expect(result.terminal).toEqual(DEFAULT_SETTINGS.terminal);
  });

  it('overrides nested jira fields', () => {
    const result = mergeWithDefaults({ jira: { baseUrl: 'https://jira.example.com' } });
    expect(result.jira.baseUrl).toBe('https://jira.example.com');
    expect(result.jira.email).toBe('');
    expect(result.jira.apiToken).toBe('');
  });

  it('does not mutate DEFAULT_SETTINGS', () => {
    const before = structuredClone(DEFAULT_SETTINGS);
    const result = mergeWithDefaults({ terminal: { fontSize: 99 } });
    result.terminal.fontSize = 999;
    expect(DEFAULT_SETTINGS).toEqual(before);
  });

  it('handles non-object section values gracefully', () => {
    const result = mergeWithDefaults({ terminal: 'invalid' as any });
    expect(result.terminal).toEqual(DEFAULT_SETTINGS.terminal);
  });
});
