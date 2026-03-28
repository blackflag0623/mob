import { describe, it, expect } from 'vitest';
import { extractJiraKey } from '../instance-manager.js';

describe('extractJiraKey', () => {
  it('extracts key from branch name', () => {
    expect(extractJiraKey('feature/PROJ-123-add-login')).toBe('PROJ-123');
  });

  it('extracts key from bare key', () => {
    expect(extractJiraKey('PROJ-456')).toBe('PROJ-456');
  });

  it('returns null for no match', () => {
    expect(extractJiraKey('main')).toBe(null);
  });

  it('returns null for undefined', () => {
    expect(extractJiraKey(undefined)).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(extractJiraKey('')).toBe(null);
  });

  it('extracts first key if multiple', () => {
    expect(extractJiraKey('PROJ-1-PROJ-2')).toBe('PROJ-1');
  });

  it('handles multi-char project prefix', () => {
    expect(extractJiraKey('AB-1')).toBe('AB-1');
  });
});
