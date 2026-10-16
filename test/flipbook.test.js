import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlipbookCanvas } from '../flipbook.js';

test('creates a canvas using the browser document rather than the PDF document', () => {
  const created = [];
  const htmlDocument = {
    createElement(tag) {
      created.push(tag);
      return { width: 0, height: 0, getContext: () => ({}) };
    },
  };
  const canvas = createFlipbookCanvas(htmlDocument, { width: 960, height: 540 });

  assert.deepEqual(created, ['canvas']);
  assert.equal(canvas.width, 960);
  assert.equal(canvas.height, 540);
});
