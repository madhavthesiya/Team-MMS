"""Strip personal contact details from student text before it is stored or sent to the AI."""
import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?<!\d)\+?\d[\d\s-]{8,}\d(?!\d)")


def redact_pii(text: str) -> str:
    return _PHONE.sub("[phone removed]", _EMAIL.sub("[email removed]", text))
