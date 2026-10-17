import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBlock,
  addLesson,
  addSection,
  generateCover,
  createCourse,
  duplicateBlock,
  moveBlock,
  removeBlock,
  updateBlock,
  addAIDraft,
  isImageFile,
  addPdfDraft,
  addSlideEmbed,
  lessonOverview,
  toGoogleSlidesEmbedUrl,
  toIframeSrc,
} from '../model.js';
import { renderCourseHtml } from '../export-html.js';
import { previewDocument } from '../preview-document.js';
import { blockLibraryItems } from '../block-library.js';

test('creates a course with one lesson and a heading block', () => {
  const course = createCourse('Curso sin título');

  assert.equal(course.title, 'Curso sin título');
  assert.equal(course.lessons.length, 1);
  assert.equal(course.lessons[0].blocks[0].type, 'heading');
  assert.equal(course.lessons[0].banner.image, '');
});

test('adds a separate lesson with its own starter section', () => {
  const course = addLesson(createCourse('Curso'), 'Aplicación práctica');
  assert.equal(course.lessons.length, 2);
  assert.equal(course.lessons[1].title, 'Aplicación práctica');
  assert.equal(course.lessons[1].blocks[0].level, 'h1');
});

test('summarizes lessons for a navigable unit view', () => {
  const course = addLesson(createCourse('Curso'), 'Aplicación práctica');

  assert.deepEqual(lessonOverview(course), [
    { id: course.lessons[0].id, number: 1, title: 'Lección 1', blockCount: 1 },
    { id: course.lessons[1].id, number: 2, title: 'Aplicación práctica', blockCount: 1 },
  ]);
});

test('adds content to the requested lesson without changing another lesson', () => {
  let course = addLesson(createCourse('Curso'), 'Aplicación práctica');
  const secondLesson = course.lessons[1];
  course = addBlock(course, 'text', secondLesson.id);
  assert.equal(course.lessons[0].blocks.length, 1);
  assert.equal(course.lessons[1].blocks.length, 2);
});

test('generates a cover and adds a navigable content section', () => {
  let course = generateCover(createCourse('Curso'));
  course = addSection(course);
  assert.equal(course.cover.enabled, true);
  assert.equal(course.lessons[0].blocks.at(-2).level, 'h1');
  assert.match(course.lessons[0].blocks.at(-2).content, /^Sección/);
});

test('adds, edits, duplicates, moves and removes blocks immutably', () => {
  let course = createCourse('Curso');
  course = addBlock(course, 'text');
  const textBlock = course.lessons[0].blocks[1];

  course = updateBlock(course, textBlock.id, { content: 'Contenido editable' });
  assert.equal(course.lessons[0].blocks[1].content, 'Contenido editable');

  course = duplicateBlock(course, textBlock.id);
  assert.equal(course.lessons[0].blocks.length, 3);

  course = moveBlock(course, textBlock.id, 2);
  assert.equal(course.lessons[0].blocks[2].content, 'Contenido editable');

  course = removeBlock(course, textBlock.id);
  assert.equal(course.lessons[0].blocks.length, 2);
});

test('adds an editable learning draft with objectives and a knowledge check', () => {
  const course = addAIDraft(createCourse('Curso'), 'Ciberseguridad para docentes');
  const types = course.lessons[0].blocks.map(block => block.type);

  assert.ok(types.includes('callout'));
  assert.ok(types.includes('accordion'));
  assert.ok(types.includes('knowledge'));
  assert.ok(course.lessons[0].blocks.some(block => block.content?.includes('Ciberseguridad para docentes')));
});

test('accepts image files for direct drop or selection', () => {
  assert.equal(isImageFile({ type: 'image/png' }), true);
  assert.equal(isImageFile({ type: 'image/jpeg' }), true);
  assert.equal(isImageFile({ type: 'application/pdf' }), false);
});

test('turns PDF headings and subheadings into summaries with image placeholders', () => {
  const text = '# Evaluación formativa\nLa retroalimentación oportuna orienta el aprendizaje y permite ajustar las estrategias de enseñanza.\n\n## Estrategias activas\nLas actividades de aplicación, discusión y análisis ayudan a que los estudiantes conecten los conceptos con situaciones reales y reciban retroalimentación útil.';
  const course = addPdfDraft(createCourse('Curso'), text);
  const blocks = course.lessons[0].blocks;
  const mainHeading = blocks.find(block => block.type === 'heading' && block.content === 'Evaluación formativa');
  const subheading = blocks.find(block => block.type === 'heading' && block.content === 'Estrategias activas');

  const mainHeadingIndex = blocks.indexOf(mainHeading);
  assert.equal(mainHeading.level, 'h1');
  assert.equal(subheading.level, 'h2');
  assert.equal(blocks[mainHeadingIndex + 1].content, 'Estrategias activas');
  assert.ok(blocks.some(block => block.type === 'text' && block.pdfSummary && block.content.includes('actividades de aplicación')));
  assert.ok(!blocks.some(block => String(block.content || '').includes('Este apartado desarrolla')));
  assert.ok(blocks.filter(block => block.type === 'image').length >= 1);
});

test('exports a standalone HTML lesson with navigation', () => {
  let course = createCourse('Curso HTML');
  const heading = course.lessons[0].blocks[0];
  course = updateBlock(course, heading.id, { content: 'Bienvenida' });
  course = addBlock(course, 'text');
  const text = course.lessons[0].blocks[1];
  course = updateBlock(course, text.id, { content: 'Contenido para exportar.' });
  course = generateCover(course);
  course = { ...course, lessons: [{ ...course.lessons[0], banner: { image: 'https://example.org/banner.jpg' } }] };
  const html = renderCourseHtml(course);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /href="#/);
  assert.match(html, /class="cover"/);
  assert.match(html, /class="resource-content"/);
  assert.match(html, /data-start-resource/);
  assert.match(html, /show-cover/);
  assert.match(html, /class="unit-banner"/);
  assert.match(html, /\.unit-banner\{[^}]*border-radius:0/);
  assert.match(html, /--cover-filter:#18322bf5/);
  assert.match(html, /--image-filter:#18322bf5/);
  assert.match(html, /banner\.jpg/);
  assert.match(html, /class="lesson-nav-item active"/);
  assert.match(html, /class="lesson-nav-number">1<\/span>/);
  assert.match(html, /class="lesson-nav-count">2<\/span>/);
  assert.match(html, /@keyframes rise-section-enter/);
  assert.match(html, /animation:rise-section-enter 900ms/);
  assert.match(html, /function playEntrance\(element\)/);
  assert.match(html, /classList\.add\('is-entering'\)/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /function showUnit/);
  assert.match(html, /lesson-unit\[hidden\]/);
  assert.match(html, /Bienvenida/);
  assert.match(html, /Contenido para exportar/);
});

test('creates a flipbook block ready for a local PDF', () => {
  const course = addBlock(createCourse('Curso'), 'flipbook');
  const block = course.lessons[0].blocks.at(-1);
  assert.deepEqual({ type: block.type, pdfData: block.pdfData, page: block.page }, { type: 'flipbook', pdfData: '', page: 1 });
});

test('creates an editable flashcard interaction with a prompt and answer', () => {
  const course = addBlock(createCourse('Curso'), 'flashcards');
  const block = course.lessons[0].blocks.at(-1);

  assert.equal(block.type, 'flashcards');
  assert.equal(block.title, 'Tarjetas de repaso');
  assert.deepEqual(block.cards, [{ front: 'Pregunta o concepto', back: 'Respuesta o explicación' }]);
});

test('offers block templates with visual previews in the right-side library', () => {
  assert.ok(blockLibraryItems.some(item => item.type === 'media-left' && item.preview === 'media-left'));
  assert.ok(blockLibraryItems.some(item => item.type === 'media-trio' && item.preview === 'media-trio'));
  assert.ok(blockLibraryItems.some(item => item.type === 'knowledge' && item.preview === 'knowledge'));
});

test('creates six editable image-and-text layout templates', () => {
  const layouts = ['media-left', 'media-pair', 'media-feature', 'media-trio', 'media-list', 'media-four'];
  let course = createCourse('Curso');
  for (const layout of layouts) course = addBlock(course, layout);

  const blocks = course.lessons[0].blocks.slice(1);
  assert.deepEqual(blocks.map(block => block.type), Array(6).fill('media-layout'));
  assert.deepEqual(blocks.map(block => block.layout), layouts);
  assert.ok(blocks.every(block => block.items.length >= 1));
});

test('uses the exported HTML as the exact preview document', () => {
  const course = addBlock(createCourse('Curso'), 'media-trio');
  assert.equal(previewDocument(course), renderCourseHtml(course));
});

test('exports an image-and-text layout as standalone HTML', () => {
  const course = addBlock(createCourse('Curso'), 'media-pair');
  const html = renderCourseHtml(course);

  assert.match(html, /media-layout/);
  assert.match(html, /Título 1/);
  assert.match(html, /Título 2/);
  assert.match(html, /\.layout-media-(?:pair|trio|four) \.media-image\{aspect-ratio:4\/3/);
});

test('creates a safe iframe source from an embed snippet or URL', () => {
  assert.equal(toIframeSrc('<iframe src="https://example.org/player" width="800"></iframe>'), 'https://example.org/player');
  assert.equal(toIframeSrc('https://example.org/resource'), 'https://example.org/resource');
  assert.equal(toIframeSrc('<iframe src="javascript:alert(1)"></iframe>'), '');
});

test('adds a Google Slides presentation as one navigable block', () => {
  const url = 'https://docs.google.com/presentation/d/abc123/edit?usp=sharing';
  const course = addSlideEmbed(createCourse('Curso'), url);
  const deck = course.lessons[0].blocks.at(-1);

  assert.equal(deck.type, 'google-slides');
  assert.equal(deck.url, 'https://docs.google.com/presentation/d/abc123/embed');
  assert.equal(toGoogleSlidesEmbedUrl(url), 'https://docs.google.com/presentation/d/abc123/embed');
});
