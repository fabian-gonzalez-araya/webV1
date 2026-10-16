# webV1 — Alba

Editor web de cursos y recursos educativos, inspirado en experiencias de autoría como Rise 360.

## Uso

Se ejecuta completamente en el navegador:

```bash
cd rise-editor
python3 -m http.server 8765
```

Luego abre `http://127.0.0.1:8765`.

Los contenidos se guardan localmente en el navegador y se pueden exportar como JSON. El proyecto incluye una base opcional de backend para la futura publicación SCORM.

## Pruebas

```bash
npm test
```
