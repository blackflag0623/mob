import { describe, it, expect } from 'vitest';
import { extractJiraKey, extractTitle } from '../instance-manager.js';

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

describe('extractTitle', () => {
  it('extracts 2-4 word title from a command prompt', () => {
    expect(extractTitle('fix the authentication bug in the login page')).toBe('Fix authentication bug');
  });

  it('strips filler prefixes', () => {
    expect(extractTitle('please fix the bug in auth')).toBe('Fix bug in auth');
    expect(extractTitle('can you add logging to the server')).toBe('Add logging to server');
    expect(extractTitle('could you refactor the API endpoints')).toBe('Refactor API endpoints');
  });

  it('returns null for trivial prompts', () => {
    expect(extractTitle('yes')).toBe(null);
    expect(extractTitle('no')).toBe(null);
    expect(extractTitle('ok')).toBe(null);
    expect(extractTitle('do it')).toBe(null);
    expect(extractTitle('go ahead')).toBe(null);
    expect(extractTitle('looks good')).toBe(null);
    expect(extractTitle('lgtm')).toBe(null);
  });

  it('returns null for short prompts', () => {
    expect(extractTitle('fix it')).toBe(null);
    expect(extractTitle('run')).toBe(null);
  });

  it('returns null for empty/null input', () => {
    expect(extractTitle('')).toBe(null);
    expect(extractTitle(null as any)).toBe(null);
  });

  it('drops trailing prepositions', () => {
    expect(extractTitle('add unit tests for the API')).toBe('Add unit tests');
    expect(extractTitle('refactor database connection in production')).toBe('Refactor database connection');
  });

  it('removes trailing punctuation', () => {
    expect(extractTitle('fix the login bug!')).toBe('Fix login bug');
  });

  it('takes only first line of multiline prompt', () => {
    expect(extractTitle('add error handling\nhere is what I mean\nmore details')).toBe('Add error handling');
  });

  it('capitalizes first letter only', () => {
    expect(extractTitle('update the README file')).toBe('Update README file');
  });
});
