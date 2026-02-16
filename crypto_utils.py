"""
NetManager — Simple credential encryption
Uses Fernet symmetric encryption (from cryptography lib) to store NVR passwords.
Falls back to base64 obfuscation if cryptography is not installed.
"""
import os
import base64

SECRET_KEY = os.getenv("SECRET_KEY", "netmanager-secret-change-in-production-2024")

try:
    from cryptography.fernet import Fernet
    # Derive a Fernet key from SECRET_KEY (must be 32 url-safe base64 bytes)
    _key_bytes = SECRET_KEY.encode("utf-8")[:32].ljust(32, b"\0")
    _fernet_key = base64.urlsafe_b64encode(_key_bytes)
    _fernet = Fernet(_fernet_key)
    _HAS_CRYPTO = True
except ImportError:
    _HAS_CRYPTO = False


def encrypt_password(plaintext: str) -> str:
    """Encrypt a password for storage."""
    if not plaintext:
        return ""
    if _HAS_CRYPTO:
        return _fernet.encrypt(plaintext.encode()).decode()
    # Fallback: base64 (NOT secure, but better than plaintext)
    return "b64:" + base64.b64encode(plaintext.encode()).decode()


def decrypt_password(ciphertext: str) -> str:
    """Decrypt a stored password."""
    if not ciphertext:
        return ""
    if ciphertext.startswith("b64:"):
        return base64.b64decode(ciphertext[4:]).decode()
    if _HAS_CRYPTO:
        try:
            return _fernet.decrypt(ciphertext.encode()).decode()
        except Exception:
            # Might be old b64 format or corrupted
            return ciphertext
    return ciphertext
