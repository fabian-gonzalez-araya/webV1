export function createFlipbookCanvas(htmlDocument, viewport) {
  const canvas = htmlDocument.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  return canvas;
}
