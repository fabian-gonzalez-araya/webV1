import { renderCourseHtml } from './export-html.js?v=20261016-navigation';

export function previewDocument(course) {
  return renderCourseHtml(course);
}
