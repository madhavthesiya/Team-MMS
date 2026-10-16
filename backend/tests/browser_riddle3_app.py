"""LOCAL TEST APP ONLY. In-memory DB and scripted model; never deploy this module.

From backend/: .venv/Scripts/python.exe -m uvicorn tests.browser_riddle3_app:app --port 8017
Then run browser_riddle3.cjs with a locally installed Playwright module path.
"""
from pathlib import Path

from app.config import Settings
from app.main import create_app
from tests.fakes import FakeAIClient, analysis, follow_up, hyp

app = create_app(Settings(
    _env_file=None, gemini_api_key="", database_url="sqlite://",
    frontend_dist=str(Path(__file__).resolve().parents[2] / "frontend" / "dist"),
    rate_limit_public="1000/minute", rate_limit_student="1000/minute",
))
fake_ai = FakeAIClient()
for _ in range(3):
    fake_ai.push(analysis("guessed", 0.8, hyp("guessed", "it looked right", 0.8)),
                 follow_up("How would you add 1/3 and 1/6?"))
app.state.ai_client = fake_ai
