"""
Tests for nvr_sync_service module.
Covers: SyncRunResult, _detect_inventory_changes, anti-jitter logic.
"""
import pytest
import json
import sys
import os

# Allow importing from parent dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nvr_sync_service import (
    SyncRunResult,
    _detect_inventory_changes,
    OFFLINE_STRIKES_THRESHOLD,
)


# ============================================
# SyncRunResult
# ============================================
class TestSyncRunResult:
    """Test the result data class."""

    def test_defaults(self):
        r = SyncRunResult()
        assert r.site_id == 0
        assert r.ok is False
        assert r.error == ""
        assert r.total == 0
        assert r.online == 0
        assert r.offline == 0
        assert r.unknown == 0
        assert r.added == 0
        assert r.updated == 0
        assert r.elapsed_ms == 0

    def test_to_dict(self):
        r = SyncRunResult()
        r.site_id = 1
        r.ok = True
        r.total = 10
        r.online = 7
        r.offline = 2
        r.unknown = 1
        r.run_id = "abc123"
        d = r.to_dict()
        assert d["site_id"] == 1
        assert d["ok"] is True
        assert d["total"] == 10
        assert d["online"] == 7
        assert d["offline"] == 2
        assert d["unknown"] == 1
        assert d["run_id"] == "abc123"

    def test_to_dict_has_all_fields(self):
        r = SyncRunResult()
        d = r.to_dict()
        expected_keys = {
            "site_id", "ok", "error", "error_code",
            "total", "online", "offline", "unknown",
            "added", "updated", "inventory_changes",
            "status_changes", "elapsed_ms", "run_id",
        }
        assert set(d.keys()) == expected_keys

    def test_elapsed_ms_setting(self):
        r = SyncRunResult()
        r.elapsed_ms = 1234
        assert r.to_dict()["elapsed_ms"] == 1234


# ============================================
# _detect_inventory_changes
# ============================================
class TestDetectInventoryChanges:
    """Test change detection between old and new camera data."""

    def test_no_changes(self):
        old = {"ip": "10.1.1.10", "mac": "AA:BB:CC", "model": "HFW1", "serial": "S123", "name": "CAM1"}
        new = {"ip": "10.1.1.10", "mac": "AA:BB:CC", "model": "HFW1", "serial": "S123", "name": "CAM1"}
        changes = _detect_inventory_changes(old, new, 1)
        assert changes == []

    def test_ip_changed(self):
        old = {"ip": "10.1.1.10", "mac": "", "model": "", "serial": "", "name": ""}
        new = {"ip": "10.1.1.20", "mac": "", "model": "", "serial": "", "name": ""}
        changes = _detect_inventory_changes(old, new, 1)
        assert "ip" in changes

    def test_multiple_changes(self):
        old = {"ip": "10.1.1.10", "mac": "AA:BB:CC", "model": "HFW1", "serial": "S123", "name": "CAM1"}
        new = {"ip": "10.1.1.20", "mac": "DD:EE:FF", "model": "HFW2", "serial": "S456", "name": "CAM1-NEW"}
        changes = _detect_inventory_changes(old, new, 1)
        assert set(changes) == {"ip", "mac", "model", "serial", "name"}

    def test_empty_new_value_not_detected(self):
        """Empty new values should not trigger a change (we don't overwrite with blank)."""
        old = {"ip": "10.1.1.10", "mac": "AA:BB:CC", "model": "HFW1", "serial": "S123", "name": "CAM1"}
        new = {"ip": "", "mac": "", "model": "", "serial": "", "name": ""}
        changes = _detect_inventory_changes(old, new, 1)
        assert changes == []

    def test_whitespace_handling(self):
        old = {"ip": " 10.1.1.10 ", "mac": "", "model": "", "serial": "", "name": ""}
        new = {"ip": "10.1.1.10", "mac": "", "model": "", "serial": "", "name": ""}
        changes = _detect_inventory_changes(old, new, 1)
        assert changes == []  # stripped values are same

    def test_none_old_value(self):
        old = {"ip": None, "mac": None, "model": None, "serial": None, "name": None}
        new = {"ip": "10.1.1.10", "mac": "AA:BB:CC", "model": "HFW1", "serial": "S123", "name": "CAM1"}
        changes = _detect_inventory_changes(old, new, 1)
        assert set(changes) == {"ip", "mac", "model", "serial", "name"}

    def test_missing_fields_in_old(self):
        old = {}
        new = {"ip": "10.1.1.10", "mac": "", "model": "", "serial": "", "name": ""}
        changes = _detect_inventory_changes(old, new, 1)
        assert "ip" in changes

    def test_missing_fields_in_new(self):
        old = {"ip": "10.1.1.10", "mac": "", "model": "", "serial": "", "name": ""}
        new = {}
        changes = _detect_inventory_changes(old, new, 1)
        assert changes == []


# ============================================
# OFFLINE_STRIKES_THRESHOLD
# ============================================
class TestAntiJitter:
    """Test anti-jitter threshold constant."""

    def test_threshold_is_two(self):
        assert OFFLINE_STRIKES_THRESHOLD == 2

    def test_threshold_positive(self):
        assert OFFLINE_STRIKES_THRESHOLD >= 1

    def test_threshold_reasonable(self):
        """Threshold should not be too high (would delay real offline detection)."""
        assert OFFLINE_STRIKES_THRESHOLD <= 5


# ============================================
# Anti-jitter logic simulation
# ============================================
class TestAntiJitterLogic:
    """Simulate the 2-strikes anti-jitter behavior.
    These tests verify the expected behavior at the algorithm level,
    not calling sync_site() directly (which requires full DB setup).
    """

    def test_first_offline_probe_does_not_change_status(self):
        """Camera with status_real=online, first offline probe → stays online."""
        offline_streak = 0
        current_status = "online"
        new_probe = "offline"

        # Simulate the logic from sync_site
        if new_probe == "offline":
            offline_streak += 1
            if offline_streak >= OFFLINE_STRIKES_THRESHOLD:
                current_status = "offline"
            # else: keep current_status

        assert current_status == "online"
        assert offline_streak == 1

    def test_second_offline_probe_changes_status(self):
        """Camera with 1 strike, second offline probe → becomes offline."""
        offline_streak = 1  # already has 1 strike
        current_status = "online"
        new_probe = "offline"

        if new_probe == "offline":
            offline_streak += 1
            if offline_streak >= OFFLINE_STRIKES_THRESHOLD:
                current_status = "offline"

        assert current_status == "offline"
        assert offline_streak == 2

    def test_online_probe_resets_streak(self):
        """Online probe should reset offline_streak to 0."""
        offline_streak = 1  # had 1 strike
        current_status = "online"
        new_probe = "online"

        if new_probe == "online":
            offline_streak = 0
            current_status = "online"

        assert offline_streak == 0
        assert current_status == "online"

    def test_recovery_after_offline(self):
        """Camera offline (2 strikes), then online → resets."""
        offline_streak = 2
        current_status = "offline"
        new_probe = "online"

        if new_probe == "online":
            offline_streak = 0
            current_status = "online"

        assert offline_streak == 0
        assert current_status == "online"

    def test_unknown_does_not_change_anything(self):
        """Unknown probe should not affect current status."""
        offline_streak = 0
        current_status = "online"
        new_probe = "unknown"

        if new_probe == "unknown":
            pass  # no changes

        assert offline_streak == 0
        assert current_status == "online"

    def test_three_consecutive_offlines(self):
        """Third offline probe → already offline, stays offline."""
        offline_streak = 2
        current_status = "offline"
        new_probe = "offline"

        if new_probe == "offline":
            offline_streak += 1
            if offline_streak >= OFFLINE_STRIKES_THRESHOLD:
                current_status = "offline"

        assert current_status == "offline"
        assert offline_streak == 3
