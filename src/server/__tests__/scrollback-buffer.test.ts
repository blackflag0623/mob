import { describe, it, expect } from 'vitest';
import { ScrollbackBuffer } from '../scrollback-buffer.js';

function createBuffer(): ScrollbackBuffer {
  // Don't call start() — avoids timers and filesystem flushes
  return new ScrollbackBuffer();
}

describe('ScrollbackBuffer', () => {
  it('getTail returns empty for unknown instance', () => {
    const buf = createBuffer();
    expect(buf.getTail('unknown', 100)).toBe('');
  });

  it('append + getTail returns data', () => {
    const buf = createBuffer();
    buf.append('a', 'hello');
    expect(buf.getTail('a', 5)).toBe('hello');
  });

  it('getTail truncates to requested chars', () => {
    const buf = createBuffer();
    buf.append('a', 'abcdef');
    expect(buf.getTail('a', 3)).toBe('def');
  });

  it('multiple appends concatenate', () => {
    const buf = createBuffer();
    buf.append('a', 'abc');
    buf.append('a', 'def');
    expect(buf.getTail('a', 6)).toBe('abcdef');
  });

  it('getTail with more chars than available returns all', () => {
    const buf = createBuffer();
    buf.append('a', 'hi');
    expect(buf.getTail('a', 100)).toBe('hi');
  });

  it('trims oldest chunks when over max bytes', () => {
    const buf = createBuffer();
    // SCROLLBACK_MAX_BYTES is 512KB. Append chunks that exceed it.
    const chunkSize = 100_000; // 100KB per chunk
    const chunk = 'x'.repeat(chunkSize);
    for (let i = 0; i < 7; i++) {
      buf.append('a', chunk);
    }
    // 700KB appended, should be trimmed to ~512KB
    // getTail should return data but less than 700KB
    const tail = buf.getTail('a', 700_000);
    expect(tail.length).toBeLessThan(700_000);
    expect(tail.length).toBeGreaterThan(0);
    // Recent data should still be present
    expect(tail).toContain('x');
  });

  it('separate instances are independent', () => {
    const buf = createBuffer();
    buf.append('a', 'aaa');
    buf.append('b', 'bbb');
    expect(buf.getTail('a', 10)).toBe('aaa');
    expect(buf.getTail('b', 10)).toBe('bbb');
  });
});
