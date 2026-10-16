"""LOCAL TEST APP ONLY. In-memory DB and scripted model; never deploy this module.

From backend/: .venv/Scripts/python.exe -m uvicorn tests.browser_riddle4_app:app --port 8018
Then run browser_riddle4.cjs with a locally installed Playwright module path.
"""
from pathlib import Path

from app.config import Settings
from app.main import create_app
from tests.fakes import FakeAIClient, analysis, hyp

app = create_app(Settings(
    _env_file=None, gemini_api_key="", gemini_api_keys="", groq_api_key="", groq_api_keys="", database_url="sqlite://",
    frontend_dist=str(Path(__file__).resolve().parents[2] / "frontend" / "dist"),
    rate_limit_public="1000/minute", rate_limit_student="1000/minute",
))
fake_ai = FakeAIClient()
for _ in range(20):  # enough for repeated runs against one server (2 widths per run)
    # first answer (settles as understood), then the check-in (explanation shows the key idea)
    fake_ai.push(analysis("understood", 0.9, hyp("understood", "2/4", 0.9)),
                 analysis("understood", 0.9, hyp("understood", "both tenths", 0.9)))
app.state.ai_client = fake_ai
