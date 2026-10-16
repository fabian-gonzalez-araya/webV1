import hashlib
import io
import json
import secrets
import sqlite3
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}:{digest.hex()}"


def create_app(db_path: Path = Path("data/alba.db"), storage_dir: Path = Path("data/objects")) -> FastAPI:
    db_path = Path(db_path)
    storage_dir = Path(storage_dir)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    storage_dir.mkdir(parents=True, exist_ok=True)

    def db() -> sqlite3.Connection:
        connection = sqlite3.connect(db_path)
        connection.row_factory = sqlite3.Row
        return connection

    with db() as connection:
        connection.executescript("""
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memberships (workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','admin','author','reviewer','learner')), PRIMARY KEY(workspace_id,user_id));
        CREATE TABLE IF NOT EXISTS access_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, cover_json TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, revision_number INTEGER NOT NULL, document_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(course_id,revision_number));
        CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, uploaded_by TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, storage_key TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS publishes (id TEXT PRIMARY KEY, course_id TEXT NOT NULL, revision_id TEXT NOT NULL, format TEXT NOT NULL, storage_key TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        """)

    app = FastAPI(title="Alba Authoring API", version="0.1.0")

    class RegisterRequest(BaseModel):
        email: str
        password: str = Field(min_length=12)
        displayName: str = Field(min_length=1, max_length=160)

    class CourseRequest(BaseModel):
        title: str = Field(min_length=1, max_length=255)
        description: str = ""
        createCover: bool = False

    class DraftRequest(BaseModel):
        document: Dict[str, Any]

    class PublishRequest(BaseModel):
        format: str

    def current_user(authorization: str = Header(default="")) -> sqlite3.Row:
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "Missing bearer token")
        token = authorization[7:]
        with db() as connection:
            user = connection.execute("""SELECT users.* FROM access_tokens JOIN users ON users.id=access_tokens.user_id WHERE access_tokens.token=?""", (token,)).fetchone()
        if not user:
            raise HTTPException(401, "Invalid bearer token")
        return user

    def workspace_for(connection: sqlite3.Connection, user_id: str) -> sqlite3.Row:
        row = connection.execute("""SELECT workspaces.*, memberships.role FROM memberships JOIN workspaces ON workspaces.id=memberships.workspace_id WHERE memberships.user_id=? ORDER BY workspaces.created_at LIMIT 1""", (user_id,)).fetchone()
        if not row:
            raise HTTPException(403, "No workspace membership")
        return row

    def course_for(connection: sqlite3.Connection, course_id: str, user: sqlite3.Row, allowed_roles=("owner", "admin", "author")) -> sqlite3.Row:
        course = connection.execute("""SELECT courses.*, memberships.role FROM courses JOIN memberships ON memberships.workspace_id=courses.workspace_id WHERE courses.id=? AND memberships.user_id=?""", (course_id, user["id"])).fetchone()
        if not course:
            raise HTTPException(404, "Course not found")
        if course["role"] not in allowed_roles:
            raise HTTPException(403, "Insufficient role")
        return course

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/v1/auth/register", status_code=201)
    def register(payload: RegisterRequest):
        user_id, workspace_id, token = uid(), uid(), secrets.token_urlsafe(32)
        created_at = now()
        try:
            with db() as connection:
                connection.execute("INSERT INTO users VALUES (?,?,?,?,?)", (user_id, payload.email.lower(), hash_password(payload.password), payload.displayName, created_at))
                connection.execute("INSERT INTO workspaces VALUES (?,?,?)", (workspace_id, f"Espacio de {payload.displayName}", created_at))
                connection.execute("INSERT INTO memberships VALUES (?,?,?)", (workspace_id, user_id, "owner"))
                connection.execute("INSERT INTO access_tokens VALUES (?,?,?)", (token, user_id, created_at))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Email already registered")
        return {"userId": user_id, "workspaceId": workspace_id, "role": "owner", "accessToken": token}

    @app.post("/api/v1/courses", status_code=201)
    def create_course(payload: CourseRequest, user: sqlite3.Row = Depends(current_user)):
        course_id, revision_id = uid(), uid()
        created_at = now()
        with db() as connection:
            workspace = workspace_for(connection, user["id"])
            cover = {"enabled": payload.createCover, "eyebrow": "Curso autoguiado", "label": "Comenzar la lección", "image": ""}
            document = {"schemaVersion": 1, "title": payload.title, "description": payload.description, "cover": cover, "lessons": [{"id": uid(), "title": "Lección 1", "blocks": []}]}
            connection.execute("INSERT INTO courses VALUES (?,?,?,?,?,?,?)", (course_id, workspace["id"], user["id"], payload.title, payload.description, json.dumps(cover), created_at))
            connection.execute("INSERT INTO revisions VALUES (?,?,?,?,?,?)", (revision_id, course_id, 1, json.dumps(document), user["id"], created_at))
        return {"id": course_id, "workspaceId": workspace["id"], "title": payload.title, "description": payload.description, "cover": cover, "revisionNumber": 1}

    @app.put("/api/v1/courses/{course_id}/draft", status_code=201)
    def save_draft(course_id: str, payload: DraftRequest, user: sqlite3.Row = Depends(current_user)):
        if payload.document.get("schemaVersion") != 1 or not isinstance(payload.document.get("lessons"), list):
            raise HTTPException(422, "Document must contain schemaVersion 1 and lessons")
        with db() as connection:
            course = course_for(connection, course_id, user)
            latest = connection.execute("SELECT COALESCE(MAX(revision_number),0) AS revision_number FROM revisions WHERE course_id=?", (course_id,)).fetchone()["revision_number"]
            revision_id, revision_number = uid(), latest + 1
            connection.execute("INSERT INTO revisions VALUES (?,?,?,?,?,?)", (revision_id, course_id, revision_number, json.dumps(payload.document), user["id"], now()))
        return {"id": revision_id, "courseId": course["id"], "revisionNumber": revision_number}

    @app.post("/api/v1/assets", status_code=201)
    async def upload_asset(file: UploadFile = File(...), user: sqlite3.Row = Depends(current_user)):
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(413, "Asset exceeds 50 MB limit")
        asset_id, storage_key = uid(), f"{uid()}-{Path(file.filename or 'asset').name}"
        target = storage_dir / storage_key
        target.write_bytes(content)
        with db() as connection:
            workspace = workspace_for(connection, user["id"])
            connection.execute("INSERT INTO assets VALUES (?,?,?,?,?,?,?,?,?)", (asset_id, workspace["id"], user["id"], file.filename or "asset", file.content_type or "application/octet-stream", len(content), storage_key, hashlib.sha256(content).hexdigest(), now()))
        return {"id": asset_id, "filename": file.filename, "byteSize": len(content), "contentType": file.content_type}

    @app.post("/api/v1/courses/{course_id}/publishes", status_code=201)
    def publish(course_id: str, payload: PublishRequest, user: sqlite3.Row = Depends(current_user)):
        if payload.format != "scorm_1_2":
            raise HTTPException(422, "Only scorm_1_2 is currently available")
        with db() as connection:
            course = course_for(connection, course_id, user)
            revision = connection.execute("SELECT * FROM revisions WHERE course_id=? ORDER BY revision_number DESC LIMIT 1", (course_id,)).fetchone()
            if not revision:
                raise HTTPException(409, "Course has no revision")
            publish_id, storage_key = uid(), f"{uid()}.zip"
            target = storage_dir / storage_key
            document = json.loads(revision["document_json"])
            html = f"<!doctype html><html lang='es'><meta charset='utf-8'><title>{document.get('title','Curso')}</title><body><h1>{document.get('title','Curso')}</h1><p>Paquete SCORM generado por Alba.</p><script>window.API=null;</script></body></html>"
            manifest = f"""<?xml version='1.0' encoding='UTF-8'?><manifest identifier='alba-{publish_id}' version='1.0' xmlns='http://www.imsproject.org/xsd/imscp_rootv1p1p2' xmlns:adlcp='http://www.adlnet.org/xsd/adlcp_rootv1p2'><organizations default='ORG'><organization identifier='ORG'><title>{document.get('title','Curso')}</title><item identifier='ITEM' identifierref='RESOURCE'><title>{document.get('title','Curso')}</title></item></organization></organizations><resources><resource identifier='RESOURCE' type='webcontent' adlcp:scormtype='sco' href='index.html'><file href='index.html'/></resource></resources></manifest>"""
            with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("imsmanifest.xml", manifest)
                archive.writestr("index.html", html)
            connection.execute("INSERT INTO publishes VALUES (?,?,?,?,?,?,?)", (publish_id, course["id"], revision["id"], payload.format, storage_key, user["id"], now()))
        return {"id": publish_id, "format": "scorm_1_2", "downloadUrl": f"/api/v1/publishes/{publish_id}/download"}

    @app.get("/api/v1/publishes/{publish_id}/download")
    def download_publish(publish_id: str, user: sqlite3.Row = Depends(current_user)):
        with db() as connection:
            publish = connection.execute("""SELECT publishes.* FROM publishes JOIN courses ON courses.id=publishes.course_id JOIN memberships ON memberships.workspace_id=courses.workspace_id WHERE publishes.id=? AND memberships.user_id=?""", (publish_id, user["id"])).fetchone()
        if not publish:
            raise HTTPException(404, "Publish not found")
        return FileResponse(storage_dir / publish["storage_key"], media_type="application/zip", filename="alba-scorm-1.2.zip")

    return app


app = create_app()
