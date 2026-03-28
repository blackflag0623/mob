import { describe, it, expect } from 'vitest';
import { detectStateFromTerminal } from '../terminal-state-detector.js';

describe('detectStateFromTerminal', () => {
  it('returns null for empty string', () => {
    expect(detectStateFromTerminal('')).toBe(null);
  });

  it('returns null for null/undefined', () => {
    expect(detectStateFromTerminal(null as any)).toBe(null);
  });

  it('detects waiting: y/n prompt', () => {
    expect(detectStateFromTerminal('Allow this? (y/n)')).toBe('waiting');
  });

  it('detects waiting: approve', () => {
    expect(detectStateFromTerminal('Please approve this action')).toBe('waiting');
  });

  it('detects waiting: allow', () => {
    expect(detectStateFromTerminal('Allow tool use?')).toBe('waiting');
  });

  it('detects waiting: yes/no', () => {
    expect(detectStateFromTerminal('Do you accept? yes or no')).toBe('waiting');
  });

  it('detects running: esc to interrupt', () => {
    expect(detectStateFromTerminal('Working... esc to interrupt')).toBe('running');
  });

  it('detects running: spinner char', () => {
    expect(detectStateFromTerminal('Processing ⠋ loading')).toBe('running');
  });

  it('detects idle: > prompt', () => {
    expect(detectStateFromTerminal('some output\n> ')).toBe('idle');
  });

  it('detects idle: $ prompt', () => {
    expect(detectStateFromTerminal('some output\n$ ')).toBe('idle');
  });

  it('returns null for unrecognized text', () => {
    expect(detectStateFromTerminal('just some random text')).toBe(null);
  });

  it('waiting takes priority over running', () => {
    expect(detectStateFromTerminal('approve? (y/n) ⠋')).toBe('waiting');
  });

  it('running takes priority over idle', () => {
    expect(detectStateFromTerminal('⠋ working\n> ')).toBe('running');
  });
});
