# InfiniDrive Bandwidth Manager - daily transfer quota tracking with persistent JSON state
import json
import logging
import datetime
import threading
from pathlib import Path
from typing import Optional, Dict, Any

try:
    from config import CONFIG_DIR, config_mgr
except ImportError:  # pragma: no cover - package-relative import fallback
    from .config import CONFIG_DIR, config_mgr

logger = logging.getLogger("infinidrive.bandwidth")

BANDWIDTH_FILE = CONFIG_DIR / "bandwidth.json"
DEFAULT_LIMIT_GB = 250.0
BYTES_PER_GB = 1024 * 1024 * 1024


class BandwidthManager:
    """Tracks per-day transferred bytes (upload + download) and enforces a daily quota.

    State is persisted to ``bandwidth.json`` inside the same app-data directory used by
    ``config.py`` (``%APPDATA%/InfiniDrive`` on Windows, ``~/.config/infinidrive`` otherwise).
    All read/write paths are defensive: a missing, unreadable or corrupt state file simply
    resets the counter for today instead of raising.
    """

    def __init__(self, state_path: Optional[Path] = None, default_limit_gb: float = DEFAULT_LIMIT_GB):
        self.state_path = Path(state_path) if state_path else BANDWIDTH_FILE
        self.default_limit_gb = float(default_limit_gb or DEFAULT_LIMIT_GB)
        self._lock = threading.Lock()
        self._date = self._today()
        self._used = 0
        self._load()

    # ---------------------------------------------------------------- internals
    @staticmethod
    def _today() -> str:
        return datetime.date.today().isoformat()

    def _load(self) -> None:
        try:
            if self.state_path.exists():
                with open(self.state_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    stored_date = str(data.get("date") or "")
                    stored_used = data.get("used_today_bytes", data.get("used_bytes", 0))
                    try:
                        stored_used = int(stored_used)
                    except (TypeError, ValueError):
                        stored_used = 0
                    if stored_date == self._today() and stored_used >= 0:
                        self._used = stored_used
                        self._date = stored_date
                        return
        except Exception as e:
            logger.warning(f"Bandwidth state unreadable ({e}); starting a fresh daily counter.")

        # Missing / corrupt / stale (previous day) -> reset for today
        self._date = self._today()
        self._used = 0
        self._save()

    def _save(self) -> None:
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "date": self._date,
                "used_today_bytes": int(self._used),
                "updated_at": datetime.datetime.now().isoformat(timespec="seconds"),
            }
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist bandwidth state: {e}")

    def _rollover_locked(self) -> None:
        """Reset the counter when the calendar date changed. Caller must hold the lock."""
        today = self._today()
        if self._date != today:
            logger.info(f"Bandwidth daily quota reset ({self._date} -> {today}).")
            self._date = today
            self._used = 0
            self._save()

    # ------------------------------------------------------------------ quota
    @property
    def quota_bytes(self) -> int:
        limit_gb = self.default_limit_gb
        try:
            cfg_limit = getattr(config_mgr.config, "bandwidth_limit_gb", None)
            if cfg_limit is not None:
                cfg_limit = float(cfg_limit)
                if cfg_limit > 0:
                    limit_gb = cfg_limit
        except Exception:
            pass
        if limit_gb <= 0:
            limit_gb = DEFAULT_LIMIT_GB
        return int(limit_gb * BYTES_PER_GB)

    # ------------------------------------------------------------- public API
    def add_bytes(self, n: int) -> int:
        """Record ``n`` transferred bytes against today's quota. Returns the new total."""
        try:
            n = int(n or 0)
        except (TypeError, ValueError):
            return self._used
        if n <= 0:
            return self._used
        with self._lock:
            self._rollover_locked()
            self._used += n
            self._save()
            return self._used

    def can_transfer(self, n: int) -> bool:
        """False when transferring ``n`` more bytes would exceed today's quota."""
        try:
            n = int(n or 0)
        except (TypeError, ValueError):
            n = 0
        if n < 0:
            n = 0
        with self._lock:
            self._rollover_locked()
            quota = self.quota_bytes
            if quota <= 0:
                return True
            return (self._used + n) <= quota

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            self._rollover_locked()
            quota = self.quota_bytes
            used = int(self._used)
            remaining = max(0, quota - used)
            percent = round(min(100.0, (used / quota) * 100.0), 2) if quota > 0 else 0.0
            return {
                "used_today_bytes": used,
                "quota_bytes": quota,
                "remaining_bytes": remaining,
                "date": self._date,
                "percent": percent,
            }

    def reset_today(self) -> Dict[str, Any]:
        """Manual reset helper (not exposed as an endpoint, useful for diagnostics)."""
        with self._lock:
            self._date = self._today()
            self._used = 0
            self._save()
        return self.get_stats()


bandwidth_manager = BandwidthManager()
