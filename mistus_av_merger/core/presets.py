"""
Preset catalog manager for VHS and visual effect styles.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class PresetManager:
    """Loads, registers, and serializes versioned presets."""

    def __init__(self, catalog_path: Optional[Path] = None):
        if catalog_path is None:
            catalog_path = Path(__file__).resolve().parent.parent / "presets" / "presets_v1.json"
        self.catalog_path = catalog_path
        self.presets: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        if self.catalog_path.exists():
            with open(self.catalog_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.presets = data.get("presets", [])
        else:
            self.presets = []

    def get_preset(self, preset_id: str) -> Optional[Dict[str, Any]]:
        for p in self.presets:
            if p.get("id") == preset_id:
                return p
        return None

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self.presets)
