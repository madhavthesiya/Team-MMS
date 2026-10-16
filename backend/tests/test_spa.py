import pytest


@pytest.fixture
def spa_client(make_client, settings, tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>app</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (dist / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("do not serve")
    return make_client(settings.model_copy(update={"frontend_dist": str(dist)}))


def test_client_routes_get_index_html(spa_client):
    for path in ("/", "/teacher/5", "/join"):
        r = spa_client.get(path)
        assert r.status_code == 200 and r.text == "<html>app</html>"


def test_static_files_are_served(spa_client):
    assert spa_client.get("/assets/app.js").text == "console.log(1)"
    assert spa_client.get("/favicon.svg").text == "<svg/>"


def test_unknown_api_paths_stay_json_404(spa_client):
    r = spa_client.get("/api/nope")
    assert r.status_code == 404 and r.json()["detail"]


def test_path_traversal_cannot_escape_dist(spa_client):
    r = spa_client.get("/..%2Fsecret.txt")
    assert "do not serve" not in r.text
