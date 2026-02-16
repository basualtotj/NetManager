"""
Tests for camera_probe module.
Covers: is_valid_ip, check_routable, probe_camera_tcp, probe_many
"""
import pytest
import asyncio
import sys
import os

# Allow importing from parent dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from camera_probe import (
    is_valid_ip,
    check_routable,
    probe_camera_tcp,
    probe_many,
    DEFAULT_PORTS,
    DEFAULT_TIMEOUT,
    DEFAULT_MAX_CONCURRENCY,
)


# ============================================
# is_valid_ip
# ============================================
class TestIsValidIp:
    """Validate IP address strings."""

    def test_valid_ipv4(self):
        assert is_valid_ip("192.168.1.1") is True

    def test_valid_ipv4_zeros(self):
        assert is_valid_ip("0.0.0.0") is True

    def test_valid_ipv4_broadcast(self):
        assert is_valid_ip("255.255.255.255") is True

    def test_valid_ipv6(self):
        assert is_valid_ip("::1") is True

    def test_valid_ipv6_full(self):
        assert is_valid_ip("2001:db8::1") is True

    def test_empty_string(self):
        assert is_valid_ip("") is False

    def test_none(self):
        assert is_valid_ip(None) is False

    def test_whitespace_only(self):
        assert is_valid_ip("   ") is False

    def test_hostname(self):
        assert is_valid_ip("nvr.local") is False

    def test_invalid_format(self):
        assert is_valid_ip("999.999.999.999") is False

    def test_partial_ip(self):
        assert is_valid_ip("192.168.1") is False

    def test_ip_with_port(self):
        assert is_valid_ip("192.168.1.1:80") is False

    def test_ip_with_whitespace(self):
        assert is_valid_ip("  10.1.1.200  ") is True

    def test_ip_with_cidr(self):
        assert is_valid_ip("10.1.0.0/24") is False


# ============================================
# probe_camera_tcp (unit tests with mocked asyncio)
# ============================================
class TestProbeCameraTcp:
    """Test single camera TCP probe logic."""

    def test_invalid_ip_returns_none(self):
        result = asyncio.get_event_loop().run_until_complete(
            probe_camera_tcp("")
        )
        assert result is None

    def test_none_ip_returns_none(self):
        result = asyncio.get_event_loop().run_until_complete(
            probe_camera_tcp(None)
        )
        assert result is None

    def test_hostname_returns_none(self):
        result = asyncio.get_event_loop().run_until_complete(
            probe_camera_tcp("my-camera.local")
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_successful_connection_returns_true(self, monkeypatch):
        """When TCP connection succeeds, return True."""
        class FakeWriter:
            def close(self): pass
            async def wait_closed(self): pass

        async def fake_open_connection(host, port):
            return (None, FakeWriter())

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await probe_camera_tcp("192.168.1.100", ports=[554], timeout_s=1.0)
        assert result is True

    @pytest.mark.asyncio
    async def test_all_ports_timeout_returns_false(self, monkeypatch):
        """When all ports time out, return False."""
        async def fake_open_connection(host, port):
            raise asyncio.TimeoutError()

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await probe_camera_tcp("192.168.1.100", ports=[554, 80], timeout_s=0.1)
        assert result is False

    @pytest.mark.asyncio
    async def test_connection_refused_returns_false(self, monkeypatch):
        """When all ports refuse connection, return False."""
        async def fake_open_connection(host, port):
            raise ConnectionRefusedError()

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await probe_camera_tcp("192.168.1.100", ports=[554], timeout_s=0.1)
        assert result is False

    @pytest.mark.asyncio
    async def test_first_port_fails_second_succeeds(self, monkeypatch):
        """Should try multiple ports, return True if any succeeds."""
        call_count = 0
        class FakeWriter:
            def close(self): pass
            async def wait_closed(self): pass

        async def fake_open_connection(host, port):
            nonlocal call_count
            call_count += 1
            if port == 554:
                raise ConnectionRefusedError()
            return (None, FakeWriter())

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await probe_camera_tcp("192.168.1.100", ports=[554, 80], timeout_s=0.1)
        assert result is True
        assert call_count == 2  # tried both ports

    def test_default_ports_exist(self):
        assert 554 in DEFAULT_PORTS
        assert 80 in DEFAULT_PORTS
        assert 37777 in DEFAULT_PORTS

    def test_default_timeout_reasonable(self):
        assert DEFAULT_TIMEOUT >= 1.0
        assert DEFAULT_TIMEOUT <= 10.0


# ============================================
# probe_many
# ============================================
class TestProbeMany:
    """Test batch probe with concurrency control."""

    @pytest.mark.asyncio
    async def test_empty_list(self):
        result = await probe_many([])
        assert result == {}

    @pytest.mark.asyncio
    async def test_cameras_with_invalid_ips(self):
        cameras = [
            {"channel": 1, "ip": ""},
            {"channel": 2, "ip": "not-an-ip"},
        ]
        result = await probe_many(cameras)
        assert result[1] == "unknown"
        assert result[2] == "unknown"

    @pytest.mark.asyncio
    async def test_unreachable_subnet_all_unknown(self, monkeypatch):
        """When subnet is unreachable, all cameras should be 'unknown'."""
        async def fake_check_routable(ip, timeout=1.0):
            return False

        import camera_probe
        monkeypatch.setattr(camera_probe, "check_routable", fake_check_routable)

        cameras = [
            {"channel": 1, "ip": "10.1.1.10"},
            {"channel": 2, "ip": "10.1.1.11"},
            {"channel": 3, "ip": "10.1.1.12"},
        ]
        result = await probe_many(cameras)
        assert all(v == "unknown" for v in result.values())
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_mixed_results(self, monkeypatch):
        """Test with mix of online, offline, unknown cameras."""
        import camera_probe

        async def fake_check_routable(ip, timeout=1.0):
            return True

        online_ips = {"10.1.1.10", "10.1.1.12"}

        async def fake_probe_camera_tcp(ip, ports=None, timeout_s=2.0):
            if not camera_probe.is_valid_ip(ip):
                return None
            if ip in online_ips:
                return True
            return False

        monkeypatch.setattr(camera_probe, "check_routable", fake_check_routable)
        monkeypatch.setattr(camera_probe, "probe_camera_tcp", fake_probe_camera_tcp)

        cameras = [
            {"channel": 1, "ip": "10.1.1.10"},   # online
            {"channel": 2, "ip": "10.1.1.11"},   # offline
            {"channel": 3, "ip": "10.1.1.12"},   # online
            {"channel": 4, "ip": ""},              # unknown
            {"channel": 5, "ip": "10.1.1.13"},   # offline
        ]
        result = await probe_many(cameras)
        assert result[1] == "online"
        assert result[2] == "offline"
        assert result[3] == "online"
        assert result[4] == "unknown"
        assert result[5] == "offline"

    @pytest.mark.asyncio
    async def test_all_channels_present_in_result(self, monkeypatch):
        """Every camera channel should appear in result dict."""
        import camera_probe
        async def fake_check_routable(ip, timeout=1.0):
            return True
        async def fake_probe(ip, ports=None, timeout_s=2.0):
            return True
        monkeypatch.setattr(camera_probe, "check_routable", fake_check_routable)
        monkeypatch.setattr(camera_probe, "probe_camera_tcp", fake_probe)

        cameras = [{"channel": i, "ip": f"10.1.1.{i}"} for i in range(1, 11)]
        result = await probe_many(cameras, max_concurrency=5)
        for i in range(1, 11):
            assert i in result

    def test_default_max_concurrency(self):
        assert DEFAULT_MAX_CONCURRENCY == 50


# ============================================
# check_routable
# ============================================
class TestCheckRoutable:
    """Test routability check."""

    def test_invalid_ip_returns_false(self):
        result = asyncio.get_event_loop().run_until_complete(
            check_routable("")
        )
        assert result is False

    def test_none_ip_returns_false(self):
        result = asyncio.get_event_loop().run_until_complete(
            check_routable(None)
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_connection_refused_means_routable(self, monkeypatch):
        """Connection refused means the host exists — it's routable."""
        async def fake_open_connection(host, port):
            raise ConnectionRefusedError()

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await check_routable("192.168.1.1", timeout=0.5)
        assert result is True

    @pytest.mark.asyncio
    async def test_network_unreachable_means_not_routable(self, monkeypatch):
        """OSError with 'unreachable' means no route."""
        async def fake_open_connection(host, port):
            raise OSError("Network is unreachable")

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await check_routable("192.168.1.1", timeout=0.5)
        assert result is False

    @pytest.mark.asyncio
    async def test_no_route_to_host_means_not_routable(self, monkeypatch):
        """OSError with 'no route to host' means not routable."""
        async def fake_open_connection(host, port):
            raise OSError("No route to host")

        monkeypatch.setattr(asyncio, "open_connection", fake_open_connection)
        result = await check_routable("192.168.1.1", timeout=0.5)
        assert result is False
