from pathlib import Path
from fastapi.testclient import TestClient

from backend.app import create_app


def client_for(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "alba.db", tmp_path / "objects"))


def register(client: TestClient, email="author@example.edu"):
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "correct-horse-battery-staple", "displayName": "Author"})
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_author_can_create_course_and_revision(tmp_path):
    client = client_for(tmp_path)
    identity = register(client)

    course = client.post("/api/v1/courses", headers=auth(identity["accessToken"]), json={"title": "Curso de prueba", "description": "Descripción", "createCover": True})
    assert course.status_code == 201, course.text
    course_data = course.json()
    assert course_data["cover"]["enabled"] is True

    revision = client.put(f"/api/v1/courses/{course_data['id']}/draft", headers=auth(identity["accessToken"]), json={"document": {"schemaVersion": 1, "lessons": [{"id": "lesson-1", "title": "Inicio", "blocks": []}]}})
    assert revision.status_code == 201, revision.text
    assert revision.json()["revisionNumber"] == 2


def test_admin_role_can_upload_asset_and_build_scorm_package(tmp_path):
    client = client_for(tmp_path)
    identity = register(client)
    headers = auth(identity["accessToken"])
    course = client.post("/api/v1/courses", headers=headers, json={"title": "Publicable"}).json()

    asset = client.post("/api/v1/assets", headers=headers, files={"file": ("nota.txt", b"contenido", "text/plain")})
    assert asset.status_code == 201, asset.text
    assert asset.json()["byteSize"] == 9

    package = client.post(f"/api/v1/courses/{course['id']}/publishes", headers=headers, json={"format": "scorm_1_2"})
    assert package.status_code == 201, package.text
    published = package.json()
    assert published["format"] == "scorm_1_2"

    download = client.get(published["downloadUrl"], headers=headers)
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/zip")
