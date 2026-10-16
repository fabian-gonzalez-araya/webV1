let sequence = 0;

function id(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function mediaLayout(layout, count) {
  return {
    type: 'media-layout',
    layout,
    title: 'Bloque de contenido',
    items: Array.from({ length: count }, (_, index) => ({
      title: `Título ${index + 1}`,
      text: 'Agrega una descripción breve para acompañar la imagen.',
      image: '',
    })),
  };
}

const templates = {
  heading: () => ({ type: 'heading', level: 'h2', content: 'Nuevo bloque de título' }),
  text: () => ({ type: 'text', content: 'Escribe aquí una explicación clara para tus estudiantes.' }),
  quote: () => ({ type: 'quote', content: 'Una idea clave que merece pausa.', attribution: '' }),
  image: () => ({ type: 'image', url: '', alt: 'Descripción de la imagen', caption: '' }),
  knowledge: () => ({
    type: 'knowledge',
    question: '¿Cuál es la respuesta correcta?',
    options: ['Opción 1', 'Opción 2', 'Opción 3'],
    correct: 0,
    feedback: 'Correcto. Revisa la explicación de esta lección.',
  }),
  divider: () => ({ type: 'divider' }),
  callout: () => ({ type: 'callout', tone: 'tip', title: 'Idea clave', content: 'Resume una idea que el estudiante debe recordar.' }),
  accordion: () => ({ type: 'accordion', title: 'Explora este concepto', content: 'Agrega una explicación, un ejemplo o una instrucción detallada.' }),
  timeline: () => ({ type: 'timeline', steps: ['Primer paso', 'Segundo paso', 'Tercer paso'] }),
  embed: () => ({ type: 'embed', provider: 'video', url: '', caption: 'Recurso complementario' }),
  iframe: () => ({ type: 'iframe', embedCode: '', src: '' }),
  attachment: () => ({ type: 'attachment', title: 'Material descargable', description: 'Documento o guía para profundizar.', url: '' }),
  pdf: () => ({ type: 'pdf', name: '' }),
  flipbook: () => ({ type: 'flipbook', name: '', pdfData: '', page: 1 }),
  flashcards: () => ({ type: 'flashcards', title: 'Tarjetas de repaso', cards: [{ front: 'Pregunta o concepto', back: 'Respuesta o explicación' }] }),
  'media-left': () => mediaLayout('media-left', 1),
  'media-pair': () => mediaLayout('media-pair', 2),
  'media-feature': () => mediaLayout('media-feature', 3),
  'media-trio': () => mediaLayout('media-trio', 3),
  'media-list': () => mediaLayout('media-list', 3),
  'media-four': () => mediaLayout('media-four', 4),
  googleSlides: () => ({ type: 'google-slides', url: '' }),
};

function makeBlock(type) {
  const factory = templates[type] || templates.text;
  return { id: id('block'), ...factory() };
}

function updateLesson(course, updater, lessonId = course.lessons[0]?.id) {
  return {
    ...course,
    updatedAt: new Date().toISOString(),
    lessons: course.lessons.map(lesson => lesson.id === lessonId ? updater(lesson) : lesson),
  };
}

export function createCourse(title = 'Curso sin título') {
  return {
    id: id('course'),
    title,
    subtitle: 'Una experiencia de aprendizaje clara y memorable.',
    cover: { enabled: false, eyebrow: 'Curso autoguiado', label: 'Comenzar la lección', image: '' },
    theme: 'cobre',
    brandColor: 'forest',
    subtitleAccent: 'cobre',
    updatedAt: new Date().toISOString(),
    lessons: [{
      id: id('lesson'),
      title: 'Lección 1',
      banner: { image: '' },
      blocks: [{ id: id('block'), type: 'heading', level: 'h1', content: 'Comienza a crear tu lección' }],
    }],
  };
}

export function addLesson(course, title = '') {
  const number = course.lessons.length + 1;
  const lessonTitle = title.trim() || `Lección ${number}`;
  return {
    ...course,
    updatedAt: new Date().toISOString(),
    lessons: [...course.lessons, {
      id: id('lesson'),
      title: lessonTitle,
      banner: { image: '' },
      blocks: [{ id: id('block'), type: 'heading', level: 'h1', content: lessonTitle }],
    }],
  };
}

export function lessonOverview(course) {
  return course.lessons.map((lesson, index) => ({
    id: lesson.id,
    number: index + 1,
    title: lesson.title,
    blockCount: lesson.blocks.length,
  }));
}

export function generateCover(course) {
  return { ...course, cover: { ...(course.cover || {}), enabled: true, eyebrow: course.cover?.eyebrow || 'Curso autoguiado', label: course.cover?.label || 'Comenzar la lección', image: course.cover?.image || '' }, updatedAt: new Date().toISOString() };
}

export function addSection(course, lessonId) {
  return updateLesson(course, lesson => {
    const count = lesson.blocks.filter(block => block.type === 'heading' && block.level === 'h1').length + 1;
    return { ...lesson, blocks: [...lesson.blocks, { id: id('block'), type: 'heading', level: 'h1', content: `Sección ${count}` }, { id: id('block'), type: 'text', content: 'Introduce el propósito de esta sección y agrega aquí los recursos de aprendizaje.' }] };
  }, lessonId);
}

export function addBlock(course, type = 'text', lessonId) {
  return updateLesson(course, lesson => ({ ...lesson, blocks: [...lesson.blocks, makeBlock(type)] }), lessonId);
}

export function updateBlock(course, blockId, patch, lessonId) {
  return updateLesson(course, lesson => ({
    ...lesson,
    blocks: lesson.blocks.map(block => block.id === blockId ? { ...block, ...patch } : block),
  }), lessonId);
}

export function removeBlock(course, blockId, lessonId) {
  return updateLesson(course, lesson => ({
    ...lesson,
    blocks: lesson.blocks.filter(block => block.id !== blockId),
  }), lessonId);
}

export function duplicateBlock(course, blockId, lessonId) {
  return updateLesson(course, lesson => {
    const index = lesson.blocks.findIndex(block => block.id === blockId);
    if (index < 0) return lesson;
    const copy = { ...lesson.blocks[index], id: id('block') };
    const blocks = [...lesson.blocks];
    blocks.splice(index + 1, 0, copy);
    return { ...lesson, blocks };
  }, lessonId);
}

export function moveBlock(course, blockId, destinationIndex, lessonId) {
  return updateLesson(course, lesson => {
    const from = lesson.blocks.findIndex(block => block.id === blockId);
    const to = Math.max(0, Math.min(destinationIndex, lesson.blocks.length - 1));
    if (from < 0 || from === to) return lesson;
    const blocks = [...lesson.blocks];
    const [block] = blocks.splice(from, 1);
    blocks.splice(to, 0, block);
    return { ...lesson, blocks };
  }, lessonId);
}

export function isImageFile(file) {
  return Boolean(file?.type && file.type.startsWith('image/'));
}

function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function sourceIntroduction(content, maximumWords) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const selected = [];
  for (const sentence of sentences) {
    const candidate = [...words(selected.join(' ')), ...words(sentence)];
    if (candidate.length > maximumWords && selected.length) break;
    selected.push(sentence.trim());
    if (candidate.length >= maximumWords) break;
  }
  return words(selected.join(' ')).slice(0, maximumWords).join(' ');
}

function outlineFromPdfText(extractedText) {
  const source = String(extractedText || '').trim();
  if (!source) return [];
  const marked = source.split('\n').map(line => line.trim()).filter(Boolean);
  if (!marked.some(line => /^#{1,2}\s+/.test(line))) {
    return source.split(/\n\s*\n/).map(group => group.trim()).filter(Boolean).map(group => {
      const lines = group.split('\n').map(line => line.trim()).filter(Boolean);
      return { level: 'h2', title: lines.shift() || 'Sección', content: lines.join(' ') };
    });
  }

  const sections = [];
  let current = null;
  for (const line of marked) {
    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { level: heading[1] === '#' ? 'h1' : 'h2', title: heading[2].trim(), content: [] };
    } else if (current) {
      current.content.push(line);
    }
  }
  if (current) sections.push(current);
  const uniqueSections = [];
  const byTitle = new Map();
  for (const section of sections) {
    const key = section.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const existing = byTitle.get(key);
    if (existing) {
      existing.content.push(...section.content);
    } else {
      byTitle.set(key, section);
      uniqueSections.push(section);
    }
  }
  return uniqueSections.map(section => ({ ...section, content: section.content.join(' ') }));
}

export function addPdfDraft(course, extractedText, lessonId) {
  const sections = outlineFromPdfText(extractedText);
  const blocks = sections.flatMap((section, index) => {
    const nextHeading = sections.slice(index + 1).find(next => next.level === 'h1' || next.level === 'h2');
    const childSubtitleFollows = section.level === 'h1' && nextHeading?.level === 'h2';
    const summary = sourceIntroduction(section.content, section.level === 'h1' ? 100 : 200);
    return [
      { id: id('block'), type: 'heading', level: section.level, content: section.title },
      ...(!childSubtitleFollows && summary ? [{ id: id('block'), type: 'text', content: summary, pdfSummary: true }] : []),
      ...(section.level === 'h2' ? [{ id: id('block'), type: 'image', url: '', alt: '', caption: '' }] : []),
    ];
  });
  return updateLesson(course, lesson => ({ ...lesson, blocks: [...lesson.blocks, ...blocks] }), lessonId);
}

export function toIframeSrc(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  const url = match ? match[1].trim() : raw;
  return /^https?:\/\//i.test(url) ? url : '';
}

export function toGoogleSlidesEmbedUrl(value) {
  const match = String(value || '').match(/^https:\/\/docs\.google\.com\/presentation\/d\/([^/?#]+)/);
  return match ? `https://docs.google.com/presentation/d/${match[1]}/embed` : '';
}

export function addSlideEmbed(course, url, lessonId) {
  const embedUrl = toGoogleSlidesEmbedUrl(url);
  if (!embedUrl) return course;
  return updateLesson(course, lesson => ({ ...lesson, blocks: [...lesson.blocks, { id: id('block'), type: 'google-slides', url: embedUrl }] }), lessonId);
}

export function addAIDraft(course, topic, lessonId) {
  const subject = topic.trim() || 'este tema';
  const draft = [
    { id: id('block'), type: 'heading', level: 'h1', content: `Aprende: ${subject}` },
    { id: id('block'), type: 'text', content: `Al terminar esta lección podrás reconocer los principios esenciales de ${subject}, aplicarlos a una situación cotidiana y decidir un siguiente paso.` },
    { id: id('block'), type: 'callout', tone: 'objective', title: 'Objetivo de aprendizaje', content: `Explicar con tus propias palabras por qué ${subject} es importante y cómo actuar de forma informada.` },
    { id: id('block'), type: 'accordion', title: `¿Qué debes saber sobre ${subject}?`, content: `Define el concepto, identifica un ejemplo cercano y relaciona la idea con una decisión real de tu contexto.` },
    { id: id('block'), type: 'knowledge', question: `¿Cuál es una buena primera acción al trabajar con ${subject}?`, options: ['Ignorar el contexto', 'Identificar el propósito y una acción concreta', 'Memorizar definiciones sin aplicarlas'], correct: 1, feedback: 'Correcto. Un buen aprendizaje empieza conectando propósito, contexto y acción.' },
  ];
  return updateLesson(course, lesson => ({ ...lesson, blocks: [...lesson.blocks, ...draft] }), lessonId);
}
