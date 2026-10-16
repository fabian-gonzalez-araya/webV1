import { addBlock, addAIDraft, addLesson, addPdfDraft, addSection, addSlideEmbed, createCourse, duplicateBlock, generateCover, isImageFile, lessonOverview, moveBlock, removeBlock, toGoogleSlidesEmbedUrl, toIframeSrc, updateBlock } from './model.js';
import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.mjs';
import { renderCourseHtml } from './export-html.js?v=20261016-image-filter';
import { createFlipbookCanvas } from './flipbook.js';
import { brandTokens, subtitleTokens, themeTokens } from './theme.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';

const storeKey = 'alba-course-v1';
let course = JSON.parse(localStorage.getItem(storeKey) || 'null') || createCourse('Curso sin título');
let preview = false;
let presentationPage = 'content';
let menuOpen = false;
let activeLessonId = course.lessons[0]?.id;
const app = document.querySelector('#app');
const flipbookDocuments = new Map();

const escape = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const lesson = () => course.lessons.find(item => item.id === activeLessonId) || course.lessons[0];
const persist = () => localStorage.setItem(storeKey, JSON.stringify(course));
const save = next => { course = next; persist(); render(); };
const toast = message => { const t = document.querySelector('.toast'); if (!t) return; t.textContent = message; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1700); };

function blockContent(block, index) {
  const input = (field, value, extra = '') => `<input ${extra} data-block="${block.id}" data-field="${field}" value="${escape(value)}">`;
  const area = (field, value, cls = 'edit-text', extra = '') => `<textarea class="${cls}" ${extra} data-block="${block.id}" data-field="${field}">${escape(value)}</textarea>`;
  if (block.type === 'heading') return `<div class="block-body">${area('content', block.content, 'edit-heading')}</div>`;
  if (block.type === 'text') return `<div class="block-body ${block.pdfSummary ? 'pdf-summary-block' : ''}">${area('content', block.content, block.pdfSummary ? 'edit-text pdf-summary' : 'edit-text', block.pdfSummary ? 'rows="8"' : '')}</div>`;
  if (block.type === 'quote') return `<div class="block-body quote">${area('content', block.content, 'edit-heading')}<input data-block="${block.id}" data-field="attribution" placeholder="Autor o fuente" value="${escape(block.attribution)}"></div>`;
  if (block.type === 'callout') return `<div class="block-body"><div class="callout tone-${escape(block.tone)}"><div class="callout-kicker">${block.tone === 'objective' ? 'Objetivo' : 'Para recordar'}</div><input class="callout-title" data-block="${block.id}" data-field="title" value="${escape(block.title)}"><textarea data-block="${block.id}" data-field="content">${escape(block.content)}</textarea></div></div>`;
  if (block.type === 'accordion') return `<div class="block-body"><details class="accordion" open><summary><input data-block="${block.id}" data-field="title" value="${escape(block.title)}"></summary><textarea data-block="${block.id}" data-field="content">${escape(block.content)}</textarea></details></div>`;
  if (block.type === 'timeline') return `<div class="block-body"><div class="timeline">${block.steps.map((step, stepIndex) => `<div class="timeline-step"><span>${stepIndex + 1}</span><input data-block="${block.id}" data-field="step" data-index="${stepIndex}" value="${escape(step)}"></div>`).join('')}</div></div>`;
  if (block.type === 'flashcards') return `<div class="block-body"><section class="flashcards"><input class="flashcards-title" data-block="${block.id}" data-field="title" value="${escape(block.title)}">${block.cards.map((card, cardIndex) => `<details class="flashcard"><summary><span>Tarjeta ${cardIndex + 1}</span><input data-block="${block.id}" data-field="front" data-index="${cardIndex}" value="${escape(card.front)}"></summary><div class="flashcard-answer"><textarea data-block="${block.id}" data-field="back" data-index="${cardIndex}">${escape(card.back)}</textarea></div></details>`).join('')}</section></div>`;
  if (block.type === 'media-layout') return `<div class="block-body"><section class="media-layout layout-${escape(block.layout)}"><input class="media-layout-heading" data-block="${block.id}" data-field="title" value="${escape(block.title)}"><div class="media-layout-items">${block.items.map((item, itemIndex) => `<article class="media-layout-item"><div class="media-layout-image ${item.image ? 'has-image' : ''}">${item.image ? `<img src="${escape(item.image)}" alt="${escape(item.title)}">` : '<span>Imagen</span>'}</div><input class="media-layout-url" data-block="${block.id}" data-field="media-image" data-index="${itemIndex}" placeholder="URL de imagen" value="${escape(item.image)}"><input class="media-layout-title" data-block="${block.id}" data-field="media-title" data-index="${itemIndex}" value="${escape(item.title)}"><textarea data-block="${block.id}" data-field="media-text" data-index="${itemIndex}">${escape(item.text)}</textarea></article>`).join('')}</div></section></div>`;
  if (block.type === 'embed') { const label = block.provider === 'video' ? 'Video o recurso integrado' : 'Recurso web'; return `<div class="block-body"><div class="embed-card"><div><div class="embed-icon">▻</div><strong>${label}</strong><p>Inserta una URL de YouTube, Vimeo, Genially o una página web.</p></div><input class="image-url" data-block="${block.id}" data-field="url" placeholder="https://…" value="${escape(block.url)}"><input class="caption" data-block="${block.id}" data-field="caption" placeholder="Título del recurso" value="${escape(block.caption)}"></div></div>`; }
  if (block.type === 'iframe') return `<div class="block-body"><div class="iframe-card"><strong>Iframe 16:9</strong><p>Pega el código &lt;iframe&gt; o una URL segura (https).</p><textarea class="iframe-input" data-block="${block.id}" data-field="embedCode" placeholder="&lt;iframe src=&quot;https://…&quot;&gt;&lt;/iframe&gt;">${escape(block.embedCode)}</textarea>${block.src ? `<div class="iframe-preview"><iframe src="${escape(block.src)}" title="Recurso integrado" allowfullscreen></iframe></div>` : ''}</div></div>`;
  if (block.type === 'attachment') return `<div class="block-body"><div class="attachment"><div class="file-mark">↓</div><div><input class="attachment-title" data-block="${block.id}" data-field="title" value="${escape(block.title)}"><textarea data-block="${block.id}" data-field="description">${escape(block.description)}</textarea><input class="attachment-url" data-block="${block.id}" data-field="url" placeholder="URL del archivo o recurso" value="${escape(block.url)}"></div></div></div>`;
  if (block.type === 'pdf') return `<div class="block-body"><div class="pdf-drop" data-drop-pdf="${block.id}"><div class="pdf-badge">PDF</div><div><strong>Convierte un PDF en bloques editables</strong><p>Arrastra un PDF: se crearán títulos, textos y espacios para imágenes.</p><label class="file-picker">Elegir PDF<input type="file" accept="application/pdf,.pdf" data-pdf-input="${block.id}"></label></div></div></div>`;
  if (block.type === 'flipbook') return `<div class="block-body">${block.pdfData ? `<div class="flipbook" data-flipbook="${block.id}"><div class="flipbook-loading">Abriendo ${escape(block.name || 'PDF')}…</div></div>` : `<div class="pdf-drop" data-drop-flipbook="${block.id}"><div class="pdf-badge">PDF</div><div><strong>Crea un flipbook integrado</strong><p>Arrastra o selecciona un PDF para navegarlo dentro de la lección.</p><label class="file-picker">Elegir PDF<input type="file" accept="application/pdf,.pdf" data-flipbook-input="${block.id}"></label></div></div>`}</div>`;
  if (block.type === 'google-slides') return block.url ? `<div class="block-body inline-slides"><iframe src="${escape(toGoogleSlidesEmbedUrl(block.url) || block.url)}" title="Google Slides" allow="autoplay" allowfullscreen></iframe></div>` : `<div class="block-body"><div class="slide-summary"><input class="attachment-url" data-block="${block.id}" data-field="url" placeholder="Pega el enlace de Google Slides" value=""></div></div>`;
  if (block.type === 'divider') return `<div class="block-body"><div class="divider"></div></div>`;
  if (block.type === 'image') {
    const asset = block.url ? `<div class="image-visual"><img class="image-preview" src="${escape(block.url)}" alt="${escape(block.alt)}"></div>` : `<div class="image-drop" data-drop-image="${block.id}"><div><strong>Arrastra una imagen aquí</strong>o selecciónala desde tu computador.<label class="file-picker">Elegir imagen<input type="file" accept="image/*" data-image-input="${block.id}"></label></div></div>`;
    return `<div class="block-body image-body">${asset}${block.url ? '' : `<input class="image-url" data-block="${block.id}" data-field="url" placeholder="https://…" value="${escape(block.url)}">`}</div>`;
  }
  if (block.type === 'knowledge') {
    const options = block.options.map((option, optionIndex) => `<label class="option ${block.correct === optionIndex ? 'correct':''}"><input type="radio" name="${block.id}" data-block="${block.id}" data-field="correct" value="${optionIndex}" ${block.correct === optionIndex ? 'checked':''}><input type="text" data-block="${block.id}" data-field="option" data-index="${optionIndex}" value="${escape(option)}"></label>`).join('');
    return `<div class="block-body"><div class="knowledge"><div class="knowledge-label">Comprobación de aprendizaje</div>${area('question', block.question, 'question')}${options}<input class="caption" data-block="${block.id}" data-field="feedback" placeholder="Retroalimentación" value="${escape(block.feedback)}"></div></div>`;
  }
  return '';
}

function blockView(block, index) {
  const upDisabled = index === 0 ? 'disabled' : '';
  const downDisabled = index === lesson().blocks.length - 1 ? 'disabled' : '';
  return `<article class="block" data-id="${block.id}" ${block.type === 'image' ? `data-drop-image="${block.id}"` : ''}><div class="block-tools"><button class="icon-btn" data-action="move-up" data-id="${block.id}" ${upDisabled} title="Subir">↑</button><button class="icon-btn" data-action="move-down" data-id="${block.id}" ${downDisabled} title="Bajar">↓</button><button class="icon-btn" data-action="duplicate" data-id="${block.id}" title="Duplicar">⧉</button><button class="icon-btn" data-action="delete" data-id="${block.id}" title="Eliminar">×</button></div>${blockContent(block, index)}</article>`;
}

function coverView() {
  const cover = course.cover;
  if (!cover?.enabled) return '';
  const image = /^https?:\/\//i.test(cover.image || '') || /^data:image\//i.test(cover.image || '') ? `<img class="cover-image" src="${escape(cover.image)}" alt="">` : '';
  const unitButtons = course.lessons.map((item, index) => `<button class="btn primary cover-unit-button" data-action="select-cover-lesson" data-id="${item.id}">Unidad ${index + 1}<span>${escape(item.title)}</span> →</button>`).join('');
  return `<section class="course-cover" id="course-cover">${image}<div class="cover-shade"></div><div class="cover-content"><input class="cover-eyebrow" data-cover="eyebrow" value="${escape(cover.eyebrow || 'Curso autoguiado')}"><input class="cover-title" data-course="title" value="${escape(course.title)}"><textarea class="cover-subtitle" data-course="subtitle">${escape(course.subtitle)}</textarea><div class="cover-actions cover-units">${unitButtons}</div></div></section>`;
}

function lessonBannerView() {
  const bannerImage = lesson().banner?.image || '';
  const validImage = /^https?:\/\//i.test(bannerImage) || /^data:image\//i.test(bannerImage);
  if (!validImage && preview) return '';
  return `<section class="lesson-banner ${validImage ? '' : 'empty'}">${validImage ? `<img src="${escape(bannerImage)}" alt="">` : ''}<div class="lesson-banner-shade"></div><div class="lesson-banner-label">Unidad ${course.lessons.indexOf(lesson()) + 1} · ${escape(lesson().title)}</div></section>`;
}

function contentNavigation() {
  const headings = lesson().blocks.filter(block => block.type === 'heading' && block.content?.trim());
  if (!headings.length) return '';
  const lessonNumber = String(course.lessons.indexOf(lesson()) + 1).padStart(2, '0');
  return `<nav class="content-nav section-submenu" aria-label="Secciones de la lección"><div class="content-nav-label">Secciones · Lección ${lessonNumber}</div>${headings.map(block => `<button class="content-nav-item level-${block.level || 'h2'}" data-action="scroll-section" data-id="${block.id}"><span class="section-dot"></span>${escape(block.content)}</button>`).join('')}</nav>`;
}

function unitOverviewView() {
  const units = lessonOverview(course);
  return `<section class="unit-overview" aria-label="Vista de unidades"><div class="unit-overview-head"><div><div class="eyebrow">Navegación del curso</div><h2>Unidades y lecciones</h2></div><span>${units.length} unidad${units.length === 1 ? '' : 'es'}</span></div><div class="unit-grid">${units.map(unit => `<button class="unit-card ${unit.id === lesson().id ? 'active' : ''}" data-action="select-lesson" data-id="${unit.id}"><span class="unit-card-number">${String(unit.number).padStart(2, '0')}</span><strong>${escape(unit.title)}</strong><small>${unit.blockCount} bloque${unit.blockCount === 1 ? '' : 's'} · ${unit.id === lesson().id ? (preview ? 'Abierta' : 'Editando') : (preview ? 'Abrir unidad →' : 'Editar unidad →')}</small></button>`).join('')}</div></section>`;
}

function render() {
  const blocks = lesson().blocks.map(blockView).join('');
  const theme = course.theme || 'cobre';
  const colors = themeTokens(theme);
  const brand = brandTokens(course.brandColor);
  const subtitle = subtitleTokens(course.subtitleAccent);
  const coverFilter = `${brand.dark}f5`;
  const themeStyle = `--copper:${colors.accent};--paper:${colors.paper};--canvas:${colors.canvas};--panel:${colors.panel};--copper-pale:${colors.pale};--brand-dark:${brand.dark};--brand-light:${brand.light};--subtitle-accent:${subtitle};--cover-filter:${coverFilter};--image-filter:${coverFilter};`;
  app.innerHTML = `<main class="shell ${preview ? 'preview':''} ${preview && course.cover?.enabled && presentationPage === 'cover' ? 'cover-page' : ''}" style="${themeStyle}">
    <aside class="sidebar"><div class="sidebar-head"><div class="brand"><span class="brand-mark"></span>alba</div><span class="mode-chip">Constructor</span></div><div class="course-map-card"><div class="course-label">Curso</div><div class="course-name">${escape(course.title)}</div><button class="outline-cover ${course.cover?.enabled ? 'ready' : ''}" data-action="open-cover"><span>◇</span>${course.cover?.enabled ? 'Portada configurada' : 'Crear portada'}</button></div>${contentNavigation()}<div class="outline-heading"><span>Lecciones</span><button data-action="new-lesson" aria-label="Nueva lección">＋</button></div><nav class="lesson-list">${course.lessons.map((item, index) => `<button class="lesson ${item.id === lesson().id ? 'active' : ''}" data-action="select-lesson" data-id="${item.id}"><span class="lesson-index">${index + 1}</span><span>${escape(item.title)}</span><small>${item.blocks.length}</small></button>`).join('')}</nav><button class="sidebar-add" data-action="new-lesson">＋ Nueva lección</button><div class="sidebar-foot">Estructura, recursos y publicación<br><span>${course.lessons.length} lección${course.lessons.length === 1 ? '' : 'es'} · Guardado local</span></div></aside>
    <section class="editor"><header class="topbar"><div class="topbar-meta"><span>Editor</span><span>·</span><span class="saved">Guardado</span></div><div class="actions"><button class="btn" data-action="ai-draft">Crear con IA</button><button class="btn" data-action="edit-cover">Editar portada</button><button class="btn" data-action="add-section">Nueva sección</button><button class="btn" data-action="new-lesson">Nueva lección</button><button class="btn" data-action="export">Exportar JSON</button><button class="btn" data-action="export-html">Exportar HTML</button><button class="btn ${preview ? 'primary':''}" data-action="preview">${preview ? 'Volver a editar' : 'Vista previa'}</button><button class="btn copper" data-action="new-course">Nuevo curso</button></div></header>${lessonBannerView()}<div class="workspace">${coverView()}<section class="course-header"><div class="eyebrow">Curso autoguiado · Lección ${String(course.lessons.indexOf(lesson()) + 1).padStart(2, '0')}</div><input class="title-input" aria-label="Título del curso" data-course="title" value="${escape(course.title)}"><input class="subtitle-input" aria-label="Subtítulo del curso" data-course="subtitle" value="${escape(course.subtitle)}"></section>${unitOverviewView()}<div class="lesson-heading"><h2>${escape(lesson().title)}</h2><button class="btn" data-action="lesson-title">Renombrar</button></div><section class="blocks">${blocks}</section><div class="add-row"><button class="add-block" data-action="toggle-add">＋ Agregar bloque</button><div class="add-menu ${menuOpen ? 'open':''}"><span class="menu-label">Contenido</span><button data-add="heading">Título</button><button data-add="text">Texto</button><button data-add="callout">Llamada</button><button data-add="accordion">Acordeón</button><button data-add="timeline">Proceso</button><button data-add="flashcards">Tarjetas</button><button data-add="knowledge">Pregunta</button><span class="menu-label">Plantillas visuales</span><button data-add="media-left">Imagen + texto</button><button data-add="media-pair">2 columnas</button><button data-add="media-feature">Imagen destacada</button><button data-add="media-trio">3 tarjetas</button><button data-add="media-list">Lista multimedia</button><button data-add="media-four">4 tarjetas</button><span class="menu-label">Recursos</span><button data-add="image">Imagen</button><button data-add="embed">Video / Embed</button><button data-add="iframe">Iframe 16:9</button><button data-add="attachment">Archivo</button><button data-add="pdf">PDF → estructura</button><button data-add="flipbook">PDF → flipbook</button><button data-add="googleSlides">Google Slides</button><button data-add="quote">Cita</button><button data-add="divider">Separador</button></div></div></div></section>
    <aside class="inspector"><h2>Diseño</h2><section class="panel"><div class="panel-title">Color de fondo</div><div class="theme-grid" role="group" aria-label="Paletas de color"><button class="swatch white ${theme === 'white'?'selected':''}" data-theme="white" title="Fondo blanco"><span>Blanco</span></button><button class="swatch cyan ${theme === 'cyan'?'selected':''}" data-theme="cyan" title="Cian"><span>Cian</span></button><button class="swatch imperial ${theme === 'imperial'?'selected':''}" data-theme="imperial" title="Azul emperador"><span>Azul emperador</span></button><button class="swatch cobre ${theme === 'cobre'?'selected':''}" data-theme="cobre" title="Cobre"><span>Cobre</span></button><button class="swatch moss ${theme === 'moss'?'selected':''}" data-theme="moss" title="Musgo"><span>Musgo</span></button><button class="swatch ink ${theme === 'ink'?'selected':''}" data-theme="ink" title="Tinta"><span>Tinta</span></button></div></section><section class="panel cover-panel"><div class="panel-title">Portada</div><button class="btn cover-edit-button" data-action="edit-cover">${course.cover?.enabled ? 'Editar portada' : 'Crear portada'}</button><label class="field-label">Imagen de portada</label><input class="field" data-cover="image" placeholder="Pega una URL de imagen" value="${escape(course.cover?.image || '')}"><label class="file-picker cover-file-picker">Subir imagen desde equipo<input type="file" accept="image/*" data-cover-image-input></label></section><section class="panel banner-panel"><div class="panel-title">Banner de esta unidad · 16:2</div><label class="field-label">Imagen independiente</label><input class="field" data-banner="image" placeholder="Pega una URL de imagen" value="${escape(lesson().banner?.image || '')}"><label class="file-picker cover-file-picker">Subir banner desde equipo<input type="file" accept="image/*" data-banner-image-input></label></section><section class="panel"><div class="panel-title">Títulos y navegación lateral</div><div class="color-choice-grid"><button class="color-choice forest ${course.brandColor === 'forest' || !course.brandColor ? 'selected' : ''}" data-brand="forest">Bosque</button><button class="color-choice cyan ${course.brandColor === 'cyan' ? 'selected' : ''}" data-brand="cyan">Cian</button><button class="color-choice imperial ${course.brandColor === 'imperial' ? 'selected' : ''}" data-brand="imperial">Azul emperador</button><button class="color-choice plum ${course.brandColor === 'plum' ? 'selected' : ''}" data-brand="plum">Ciruela</button></div></section><section class="panel"><div class="panel-title">Acento de subtítulos</div><div class="accent-choice-grid"><button class="accent-choice cobre ${course.subtitleAccent === 'cobre' || !course.subtitleAccent ? 'selected' : ''}" data-subtitle-accent="cobre">Cobre</button><button class="accent-choice cyan ${course.subtitleAccent === 'cyan' ? 'selected' : ''}" data-subtitle-accent="cyan">Cian</button><button class="accent-choice oro ${course.subtitleAccent === 'oro' ? 'selected' : ''}" data-subtitle-accent="oro">Oro</button><button class="accent-choice violeta ${course.subtitleAccent === 'violeta' ? 'selected' : ''}" data-subtitle-accent="violeta">Violeta</button></div></section><section class="panel"><div class="panel-title">Lección</div><label class="field-label">Nombre</label><input class="field" data-lesson="title" value="${escape(lesson().title)}"></section><section class="panel"><div class="panel-title">Publicación</div><p class="help">Este prototipo guarda localmente y permite exportar el curso en JSON. La próxima etapa es publicar en SCORM para Moodle.</p></section></aside>
  </main><div class="toast" role="status"></div>`;
  app.querySelectorAll('textarea.pdf-summary').forEach(textarea => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
  hydrateFlipbooks();
}

function importCoverImage(file) {
  if (!isImageFile(file)) { toast('Selecciona un archivo de imagen'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    course = { ...course, cover: { ...(course.cover || {}), enabled: true, image: reader.result }, updatedAt: new Date().toISOString() };
    persist();
    render();
    toast('Imagen de portada actualizada');
  };
  reader.readAsDataURL(file);
}

function updateLessonBanner(image) {
  course = { ...course, lessons: course.lessons.map(item => item.id === lesson().id ? { ...item, banner: { ...(item.banner || {}), image } } : item), updatedAt: new Date().toISOString() };
  persist();
  render();
}

function importLessonBanner(file) {
  if (!isImageFile(file)) { toast('Selecciona un archivo de imagen'); return; }
  const reader = new FileReader();
  reader.onload = () => { updateLessonBanner(reader.result); toast('Banner de unidad actualizado'); };
  reader.readAsDataURL(file);
}

function importImage(blockId, file) {
  if (!isImageFile(file)) { toast('Selecciona un archivo de imagen'); return; }
  const reader = new FileReader();
  reader.onload = () => { save(updateBlock(course, blockId, { url: reader.result, alt: file.name.replace(/\.[^.]+$/, '') }, lesson().id)); toast('Imagen agregada'); };
  reader.readAsDataURL(file);
}

async function importPdf(blockId, file) {
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) { toast('Selecciona un archivo PDF'); return; }
  try {
    toast('Leyendo PDF…');
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const items = (await page.getTextContent()).items.filter(item => item.str?.trim());
      const sizes = items.map(item => Math.abs(item.transform?.[0] || 0)).filter(Boolean).sort((a, b) => a - b);
      const median = sizes[Math.floor(sizes.length / 2)] || 10;
      const lines = new Map();
      items.forEach(item => {
        const y = Math.round(item.transform?.[5] || 0);
        const row = lines.get(y) || { y, x: item.transform?.[4] || 0, text: '', size: 0 };
        row.text += `${row.text ? ' ' : ''}${item.str}`;
        row.size = Math.max(row.size, Math.abs(item.transform?.[0] || 0));
        lines.set(y, row);
      });
      pages.push([...lines.values()].sort((a, b) => b.y - a.y).map(line => {
        const text = line.text.trim();
        if (line.size >= median * 1.65) return `# ${text}`;
        if (line.size >= median * 1.25) return `## ${text}`;
        return text;
      }).join('\n'));
    }
    const parsed = addPdfDraft(course, pages.join('\n\n'), lesson().id);
    course = removeBlock(parsed, blockId, lesson().id); persist(); render(); toast(`PDF convertido: ${document.numPages} página(s)`);
  } catch (error) { console.error(error); toast('No se pudo extraer texto del PDF'); }
}

async function importFlipbook(blockId, file) {
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) { toast('Selecciona un archivo PDF'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    flipbookDocuments.delete(blockId);
    save(updateBlock(course, blockId, { name: file.name, pdfData: reader.result, page: 1 }, lesson().id));
    toast('Flipbook creado');
  };
  reader.readAsDataURL(file);
}

async function showFlipbookPage(blockId, requestedPage = 1) {
  const target = app.querySelector(`[data-flipbook="${blockId}"]`);
  const block = lesson().blocks.find(item => item.id === blockId);
  if (!target || !block?.pdfData) return;
  try {
    target.innerHTML = '<div class="flipbook-loading">Cargando página…</div>';
    let documentPromise = flipbookDocuments.get(blockId);
    if (!documentPromise) {
      const data = await fetch(block.pdfData).then(response => response.arrayBuffer());
      documentPromise = pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
      flipbookDocuments.set(blockId, documentPromise);
    }
    const pdfDocument = await documentPromise;
    const pageNumber = Math.max(1, Math.min(requestedPage, pdfDocument.numPages));
    const pdfPage = await pdfDocument.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1.45 });
    const canvas = createFlipbookCanvas(window.document, viewport);
    await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    target.innerHTML = `<div class="flipbook-page"></div><div class="flipbook-controls"><button class="btn" data-flip-page="${blockId}" data-page="${pageNumber - 1}" ${pageNumber === 1 ? 'disabled' : ''}>← Anterior</button><span>Página ${pageNumber} de ${pdfDocument.numPages}</span><button class="btn primary" data-flip-page="${blockId}" data-page="${pageNumber + 1}" ${pageNumber === pdfDocument.numPages ? 'disabled' : ''}>Siguiente →</button></div>`;
    target.querySelector('.flipbook-page').append(canvas);
    target.querySelectorAll('[data-flip-page]').forEach(button => button.addEventListener('click', () => showFlipbookPage(blockId, Number(button.dataset.page))));
  } catch (error) {
    console.error(error);
    target.innerHTML = '<div class="flipbook-error">No se pudo abrir este PDF.</div>';
  }
}

function hydrateFlipbooks() {
  lesson().blocks.filter(block => block.type === 'flipbook' && block.pdfData).forEach(block => showFlipbookPage(block.id, block.page || 1));
}

function changeBlock(target) {
  const id = target.dataset.block;
  const field = target.dataset.field;
  const block = lesson().blocks.find(item => item.id === id);
  if (!block) return;
  let patch;
  if (field === 'option') { const options = [...block.options]; options[Number(target.dataset.index)] = target.value; patch = { options }; }
  else if (field === 'step') { const steps = [...block.steps]; steps[Number(target.dataset.index)] = target.value; patch = { steps }; }
  else if (field === 'front' || field === 'back') { const cards = block.cards.map((card, index) => index === Number(target.dataset.index) ? { ...card, [field]: target.value } : card); patch = { cards }; }
  else if (field === 'media-title' || field === 'media-text' || field === 'media-image') { const key = field.replace('media-', ''); const items = block.items.map((item, index) => index === Number(target.dataset.index) ? { ...item, [key]: target.value } : item); patch = { items }; }
  else if (field === 'correct') patch = { correct: Number(target.value) };
  else if (field === 'url' && block.type === 'google-slides') patch = { url: toGoogleSlidesEmbedUrl(target.value) || target.value };
  else if (field === 'embedCode' && block.type === 'iframe') patch = { embedCode: target.value, src: toIframeSrc(target.value) };
  else patch = { [field]: target.value };
  course = updateBlock(course, id, patch, lesson().id); persist();
  if (field === 'correct') render();
}

app.addEventListener('dragenter', event => {
  const target = event.target.closest('[data-drop-image],[data-drop-pdf],[data-drop-flipbook]');
  if (target) target.classList.add('dragging');
});
app.addEventListener('dragleave', event => {
  const target = event.target.closest('[data-drop-image],[data-drop-pdf],[data-drop-flipbook]');
  if (target && !target.contains(event.relatedTarget)) target.classList.remove('dragging');
});
app.addEventListener('dragover', event => {
  if (event.target.closest('[data-drop-image],[data-drop-pdf],[data-drop-flipbook]')) event.preventDefault();
});
app.addEventListener('drop', event => {
  const imageTarget = event.target.closest('[data-drop-image]');
  const pdfTarget = event.target.closest('[data-drop-pdf]');
  const flipbookTarget = event.target.closest('[data-drop-flipbook]');
  if (!imageTarget && !pdfTarget && !flipbookTarget) return;
  event.preventDefault();
  if (imageTarget) importImage(imageTarget.dataset.dropImage, event.dataTransfer.files[0]);
  if (pdfTarget) importPdf(pdfTarget.dataset.dropPdf, event.dataTransfer.files[0]);
  if (flipbookTarget) importFlipbook(flipbookTarget.dataset.dropFlipbook, event.dataTransfer.files[0]);
});
app.addEventListener('change', event => {
  if (event.target.dataset.imageInput) importImage(event.target.dataset.imageInput, event.target.files[0]);
  if (event.target.dataset.coverImageInput) importCoverImage(event.target.files[0]);
  if (event.target.dataset.bannerImageInput) importLessonBanner(event.target.files[0]);
  if (event.target.dataset.banner) updateLessonBanner(event.target.value);
  if (event.target.dataset.pdfInput) importPdf(event.target.dataset.pdfInput, event.target.files[0]);
  if (event.target.dataset.flipbookInput) importFlipbook(event.target.dataset.flipbookInput, event.target.files[0]);
  if (event.target.dataset.cover) { const key = event.target.dataset.cover; course = { ...course, cover: { ...(course.cover || {}), [key]: event.target.value, ...(key === 'image' ? { enabled: true } : {}) } }; persist(); if (key === 'image') render(); }
  if (event.target.dataset.block) { changeBlock(event.target); if (['url', 'embedCode'].includes(event.target.dataset.field)) render(); }
});
app.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.course) { course = { ...course, [target.dataset.course]: target.value, updatedAt:new Date().toISOString() }; persist(); }
  if (target.dataset.lesson) { course = { ...course, lessons: course.lessons.map(item => item.id === lesson().id ? { ...item, [target.dataset.lesson]: target.value } : item) }; persist(); }
  if (target.dataset.cover) { course = { ...course, cover: { ...(course.cover || {}), [target.dataset.cover]: target.value } }; persist(); }
  if (target.dataset.block) changeBlock(target);
  if (target.matches('textarea.pdf-summary')) {
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  }
});
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.add) { save(addBlock(course, button.dataset.add, lesson().id)); menuOpen = false; return; }
  if (button.dataset.theme) { save({ ...course, theme:button.dataset.theme }); return; }
  if (button.dataset.brand) { save({ ...course, brandColor:button.dataset.brand }); return; }
  if (button.dataset.subtitleAccent) { save({ ...course, subtitleAccent:button.dataset.subtitleAccent }); return; }
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'toggle-add') { menuOpen = !menuOpen; render(); }
  if (action === 'preview') { preview = !preview; presentationPage = preview && course.cover?.enabled ? 'cover' : 'content'; render(); }
  if (action === 'generate-cover') { save(generateCover(course)); toast('Portada creada'); }
  if (action === 'edit-cover') { if (!course.cover?.enabled) { save(generateCover(course)); } setTimeout(() => document.querySelector('#course-cover')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }
  if (action === 'open-cover') { if (!course.cover?.enabled) { save(generateCover(course)); toast('Portada creada'); } setTimeout(() => document.querySelector('#course-cover')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }
  if (action === 'add-section') { save(addSection(course, lesson().id)); toast('Sección añadida al menú lateral'); }
  if (action === 'scroll-cover') { document.querySelector('#course-cover')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (action === 'scroll-lesson') { if (preview && presentationPage === 'cover') { presentationPage = 'content'; render(); } else { document.querySelector('.lesson-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
  if (action === 'scroll-section') { document.querySelector(`article[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  if (action === 'ai-draft') { const topic = prompt('Tema u objetivo del borrador'); if (topic?.trim()) { save(addAIDraft(course, topic, lesson().id)); toast('Borrador generado: revísalo y personalízalo'); } }
  if (action === 'new-course') { if (confirm('¿Crear un curso nuevo? El curso actual seguirá guardado solo si lo exportas.')) { course = createCourse('Curso sin título'); activeLessonId = course.lessons[0].id; persist(); render(); } }
  if (action === 'new-lesson') { const title = prompt('Nombre de la nueva lección', `Lección ${course.lessons.length + 1}`); if (title?.trim()) { course = addLesson(course, title); activeLessonId = course.lessons.at(-1).id; persist(); render(); } }
  if (action === 'select-lesson') { activeLessonId = id; render(); }
  if (action === 'select-cover-lesson') { activeLessonId = id; if (preview) { presentationPage = 'content'; render(); } else { setTimeout(() => document.querySelector('.lesson-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); } }
  if (action === 'lesson-title') { const title = prompt('Nombre de la lección', lesson().title); if (title?.trim()) { course = { ...course, lessons: course.lessons.map(item => item.id === lesson().id ? { ...item, title: title.trim() } : item) }; persist(); render(); } }
  if (action === 'delete') { save(removeBlock(course, id, lesson().id)); }
  if (action === 'duplicate') { save(duplicateBlock(course, id, lesson().id)); }
  if (action === 'move-up') { const index = lesson().blocks.findIndex(item => item.id === id); save(moveBlock(course, id, index - 1, lesson().id)); }
  if (action === 'move-down') { const index = lesson().blocks.findIndex(item => item.id === id); save(moveBlock(course, id, index + 1, lesson().id)); }
  if (action === 'export') { const blob = new Blob([JSON.stringify(course, null, 2)], { type:'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${course.title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'curso'}.json`; link.click(); URL.revokeObjectURL(link.href); toast('Curso exportado en formato JSON'); }
  if (action === 'export-html') { const blob = new Blob([renderCourseHtml(course)], { type:'text/html;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${course.title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'curso'}.html`; link.click(); URL.revokeObjectURL(link.href); toast('Lección exportada en HTML'); }
});
render();
