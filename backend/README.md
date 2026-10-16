# Alba API

Backend local para la siguiente fase del editor.

## Ejecutar

```bash
cd /Users/fabiangonzalezaraya/rise-editor
backend/.venv/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8787
```

Documentación interactiva: http://127.0.0.1:8787/docs

## Pruebas

```bash
backend/.venv/bin/python -m pytest backend/tests/test_api.py -q
```

## Implementado

- Registro de usuario, token de acceso y espacio de trabajo propietario.
- Roles persistidos: owner, admin, author, reviewer y learner.
- Cursos y revisiones inmutables del documento de curso.
- Carga de archivos al almacenamiento de objetos local `backend/data/objects`.
- Publicación de un paquete SCORM 1.2 descargable con `imsmanifest.xml`.

## Límites actuales

El almacenamiento es local para desarrollo. Para producción debe sustituirse por un adaptador S3/R2/MinIO con credenciales en variables de entorno. El paquete SCORM es una base verificable de empaquetado; la comunicación de progreso con Moodle y la autenticación real de Moodle requieren configurar una instancia de prueba y credenciales Moodle/LTI o Web Services.
