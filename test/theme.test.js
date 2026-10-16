import test from 'node:test';
import assert from 'node:assert/strict';
import { brandTokens, subtitleTokens, themeTokens } from '../theme.js';

test('provides white, cyan and imperial-blue visual themes', () => {
  assert.deepEqual(themeTokens('white'), { accent: '#285f8f', paper: '#ffffff', canvas: '#eef2f5', panel: '#f7f9fb', pale: '#e7f0f8' });
  assert.equal(themeTokens('cyan').accent, '#008da8');
  assert.equal(themeTokens('imperial').accent, '#2447a5');
  assert.equal(themeTokens('unknown').accent, '#c75c35');
  assert.deepEqual(brandTokens('imperial'), { dark: '#1e3a8a', light: '#5376d1' });
  assert.equal(subtitleTokens('violeta'), '#7850a9');
});
