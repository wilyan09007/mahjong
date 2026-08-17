import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

describe('scaffold', () => {
  it('imports the engine package', () => {
    expect(ENGINE_VERSION).toBe('0.1.0');
  });
});
