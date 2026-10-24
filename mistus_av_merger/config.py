"""
Configuration and persistence management for Mistus AV Merger.
Supports standard OS user-data paths and self-contained portable mode (portable.flag).
"""

import json
import os
import platform
import sys
from pathlib import Path
from typing import Any, Dict

from mistus_av_merger.core.versioning import CURRENT_SCHEMA_VERSION, load_and_migrate_json


def get_app_root() -> Path:
    """Returns directory containing the binary or script."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def is_portable_mode() -> bool:
    """Returns True if 'portable.flag' exists next to the binary/app root."""
    return (get_app_root() / "portable.flag").exists()


def get_data_dir() -> Path:
    """
    Returns platform-appropriate config/data folder or local folder in portable mode.
    """
    if is_portable_mode():
        data_dir = get_app_root() / "data"
    else:
        system = platform.system()
        if system == "Windows":
            base = os.getenv("APPDATA") or str(Path.home() / "AppData" / "Roaming")
            data_dir = Path(base) / "MistusAVMerger"
        elif system == "Darwin":
            data_dir = Path.home() / "Library" / "Application Support" / "MistusAVMerger"
        else:
            base = os.getenv("XDG_CONFIG_HOME") or str(Path.home() / ".config")
            data_dir = Path(base) / "MistusAVMerger"

    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_log_dir() -> Path:
    log_dir = get_data_dir() / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_temp_dir() -> Path:
    temp_dir = get_data_dir() / "temp_segments"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir


class SettingsManager:
    """Manages persistent application settings with versioned schemas."""

    def __init__(self):
        self.config_path = get_data_dir() / "settings.json"
        self.settings: Dict[str, Any] = self._load_default_settings()
        self.load()

    def _load_default_settings(self) -> Dict[str, Any]:
        return {
            "schema_version": CURRENT_SCHEMA_VERSION,
            "last_audio_folder": str(Path.home()),
            "last_video_folder": str(Path.home()),
            "last_output_folder": str(Path.home() / "Videos"),
            "last_overlay_folder": str(Path.home()),
            "last_single_audio": "",
            "last_single_video": "",
            "last_single_overlay": "",
            "last_bulk_mode": "cycle",
            "last_naming_pattern": "{audio_name}.{video_ext}",
            "collision_policy": "suffix",
            "cpu_profile": "balanced",
            "concurrency": 1,
            "segment_duration_sec": 120,
            "hardware_accel_preference": "auto",
        }

    def load(self):
        if self.config_path.exists():
            try:
                loaded = load_and_migrate_json(self.config_path, CURRENT_SCHEMA_VERSION)
                self.settings.update(loaded)
            except Exception as e:
                print(f"[Warning] Failed to load settings from {self.config_path}: {e}")

    def save(self):
        self.settings["schema_version"] = CURRENT_SCHEMA_VERSION
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.settings, f, indent=2)

    def get(self, key: str, default: Any = None) -> Any:
        return self.settings.get(key, default)

    def set(self, key: str, value: Any):
        self.settings[key] = value
        self.save()
