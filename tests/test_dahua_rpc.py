"""
Tests for dahua_rpc module.
Covers: normalize_target, compute_dahua_hash, _parse_connection_state, DahuaRpcError
"""
import pytest
import sys
import os

# Allow importing from parent dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dahua_rpc import (
    normalize_target,
    compute_dahua_hash,
    DahuaRpcError,
    _parse_connection_state,
    _infer_model,
)


# ============================================
# normalize_target
# ============================================
class TestNormalizeTarget:
    """Input validation for IP/port → base_url."""

    def test_valid_ip_default_port(self):
        assert normalize_target("10.1.1.200") == "http://10.1.1.200:80"

    def test_valid_ip_custom_port(self):
        assert normalize_target("10.1.1.200", 8080) == "http://10.1.1.200:8080"

    def test_valid_hostname(self):
        assert normalize_target("nvr.local", 80) == "http://nvr.local:80"

    def test_valid_port_443(self):
        assert normalize_target("192.168.1.1", 443) == "http://192.168.1.1:443"

    def test_strips_whitespace(self):
        assert normalize_target("  10.1.1.200  ", 80) == "http://10.1.1.200:80"

    def test_empty_ip_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("", 80)
        assert exc.value.code == "INVALID_TARGET"
        assert "vacío" in exc.value.message

    def test_none_ip_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target(None, 80)
        assert exc.value.code == "INVALID_TARGET"

    def test_port_37777_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200", 37777)
        assert exc.value.code == "INVALID_TARGET"
        assert "37777" in exc.value.message
        assert "binario" in exc.value.message.lower()

    def test_port_zero_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200", 0)
        assert exc.value.code == "INVALID_TARGET"

    def test_port_negative_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200", -1)
        assert exc.value.code == "INVALID_TARGET"

    def test_port_too_high_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200", 70000)
        assert exc.value.code == "INVALID_TARGET"

    def test_ip_with_spaces_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200 ; rm -rf /", 80)
        assert exc.value.code == "INVALID_TARGET"

    def test_ip_with_quotes_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200'--", 80)
        assert exc.value.code == "INVALID_TARGET"

    def test_ip_with_semicolon_raises(self):
        with pytest.raises(DahuaRpcError) as exc:
            normalize_target("10.1.1.200;ls", 80)
        assert exc.value.code == "INVALID_TARGET"

    def test_port_1_valid(self):
        assert normalize_target("10.0.0.1", 1) == "http://10.0.0.1:1"

    def test_port_65535_valid(self):
        assert normalize_target("10.0.0.1", 65535) == "http://10.0.0.1:65535"


# ============================================
# compute_dahua_hash
# ============================================
class TestComputeDahuaHash:
    """Verify MD5 challenge-response matches Dahua web client behavior."""

    def test_known_values(self):
        """
        Known test vector:
        username=admin, password=admin, realm=Login to 123456789, random=ABCDEF
        Step1 = MD5("admin:Login to 123456789:admin") → uppercase
        Step2 = MD5("admin:ABCDEF:<step1>") → uppercase
        """
        import hashlib
        username = "admin"
        password = "admin"
        realm = "Login to 123456789"
        random_val = "ABCDEF"

        step1 = hashlib.md5(f"{username}:{realm}:{password}".encode()).hexdigest().upper()
        step2 = hashlib.md5(f"{username}:{random_val}:{step1}".encode()).hexdigest().upper()

        result = compute_dahua_hash(username, password, realm, random_val)
        assert result == step2
        assert result == result.upper()  # must be uppercase
        assert len(result) == 32  # MD5 hex length

    def test_different_passwords_different_hashes(self):
        h1 = compute_dahua_hash("admin", "password1", "realm", "random")
        h2 = compute_dahua_hash("admin", "password2", "realm", "random")
        assert h1 != h2

    def test_different_realms_different_hashes(self):
        h1 = compute_dahua_hash("admin", "pass", "realm1", "random")
        h2 = compute_dahua_hash("admin", "pass", "realm2", "random")
        assert h1 != h2

    def test_different_random_different_hashes(self):
        h1 = compute_dahua_hash("admin", "pass", "realm", "random1")
        h2 = compute_dahua_hash("admin", "pass", "realm", "random2")
        assert h1 != h2

    def test_always_uppercase(self):
        result = compute_dahua_hash("user", "pass", "realm", "random")
        assert result == result.upper()

    def test_always_32_chars(self):
        result = compute_dahua_hash("u", "p", "r", "v")
        assert len(result) == 32

    def test_empty_password(self):
        """Should not crash on empty password."""
        result = compute_dahua_hash("admin", "", "realm", "random")
        assert len(result) == 32


# ============================================
# _parse_connection_state
# ============================================
class TestParseConnectionState:
    """Verify ConnectionState parsing from various Dahua firmware formats."""

    def test_bool_true(self):
        assert _parse_connection_state({"ConnectionState": True}) == "online"

    def test_bool_false(self):
        assert _parse_connection_state({"ConnectionState": False}) == "offline"

    def test_string_true(self):
        assert _parse_connection_state({"ConnectionState": "true"}) == "online"

    def test_string_connected(self):
        assert _parse_connection_state({"ConnectionState": "Connected"}) == "online"

    def test_string_1(self):
        assert _parse_connection_state({"ConnectionState": "1"}) == "online"

    def test_string_false(self):
        assert _parse_connection_state({"ConnectionState": "false"}) == "offline"

    def test_string_disconnected(self):
        assert _parse_connection_state({"ConnectionState": "Disconnected"}) == "offline"

    def test_int_1(self):
        assert _parse_connection_state({"ConnectionState": 1}) == "online"

    def test_int_0(self):
        assert _parse_connection_state({"ConnectionState": 0}) == "offline"

    def test_no_connection_state_enable_true(self):
        """Fallback: no ConnectionState, Enable=True → online."""
        assert _parse_connection_state({"Enable": True}) == "online"

    def test_no_connection_state_enable_false(self):
        """Fallback: no ConnectionState, Enable=False → offline."""
        assert _parse_connection_state({"Enable": False}) == "offline"

    def test_no_connection_state_no_enable(self):
        """Fallback: neither field → offline."""
        assert _parse_connection_state({}) == "offline"


# ============================================
# _infer_model
# ============================================
class TestInferModel:
    """Model inference from serial prefix + firmware."""

    def test_known_serial_prefix(self):
        assert _infer_model("9B000AAPAG12345", "2.800.0000000.8.R") == "DH-IPC-HDW1239T1-A-LED-S5"

    def test_second_rule(self):
        assert _infer_model("9F0E033PAG12345", "anything") == "DH-IPC-HFW2441S-S"

    def test_unknown_serial(self):
        assert _infer_model("UNKNOWN12345", "1.0.0") == ""

    def test_empty_serial(self):
        assert _infer_model("", "") == ""


# ============================================
# DahuaRpcError
# ============================================
class TestDahuaRpcError:
    """Error class structure."""

    def test_code_and_message(self):
        e = DahuaRpcError("TIMEOUT", "El NVR no respondió", "http://10.1.1.200:80")
        assert e.code == "TIMEOUT"
        assert e.message == "El NVR no respondió"
        assert e.base_url == "http://10.1.1.200:80"

    def test_to_dict(self):
        e = DahuaRpcError("CONNECT", "No se pudo conectar", "http://10.0.0.1:80")
        d = e.to_dict()
        assert d["code"] == "CONNECT"
        assert d["message"] == "No se pudo conectar"
        assert d["base_url"] == "http://10.0.0.1:80"

    def test_str_includes_code(self):
        e = DahuaRpcError("INVALID_TARGET", "Puerto 37777 inválido")
        assert "[INVALID_TARGET]" in str(e)

    def test_is_exception(self):
        e = DahuaRpcError("RPC_ERROR", "Algo falló")
        assert isinstance(e, Exception)
