"""Link-style access without accounts. Raw tokens go to the client once; only SHA-256 hashes are stored."""
import hashlib
import hmac
import secrets

_JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I — easy to read aloud in class


def new_token() -> str:
    return secrets.token_urlsafe(24)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def token_matches(token: str, token_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), token_hash)


def new_join_code() -> str:
    return "".join(secrets.choice(_JOIN_ALPHABET) for _ in range(6))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password(password: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return False
    salt, hashed = stored_hash.split("$", 1)
    test_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return hmac.compare_digest(test_hash, hashed)


def new_auth_token() -> str:
    return secrets.token_urlsafe(32)
