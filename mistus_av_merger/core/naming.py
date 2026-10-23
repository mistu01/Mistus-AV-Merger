"""
Output naming engine, token expansion, cross-platform filename sanitization,
container safety resolution, and collision policies.
"""

import datetime
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


def sanitize_filename(filename: str, os_type: str = "linux") -> str:
    """
    Sanitizes filename across Windows, macOS, and Linux:
    - Removes illegal characters <>:"/\\|?*
    - Strips trailing spaces and dots from base name (invalid on Windows)
    - Prevents Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    - Clamps length to 220 chars.
    """
    if not filename or not filename.strip():
        return "unnamed_output.mp4"

    raw = filename.strip()

    # Split base and extension
    match = re.search(r"\.[^.]+$", raw)
    if match:
        ext = match.group(0)
        base = raw[:-len(ext)]
    else:
        ext = ""
        base = raw

    # Replace forbidden chars
    base = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", base)
    ext = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", ext)

    # Strip trailing periods/spaces from base
    base = re.sub(r"[. ]+$", "", base).strip()

    # Windows reserved names check
    reserved_pattern = r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$"
    if re.match(reserved_pattern, base, re.IGNORECASE):
        base = f"safe_{base}"

    # Clamping
    if len(base + ext) > 220:
        base = base[:220 - len(ext)]

    return f"{base or 'output'}{ext}"


def resolve_container_safety(
    video_ext: str,
    audio_codec: Optional[str] = None,
    is_reencode: bool = False,
) -> Tuple[str, bool, str]:
    """
    Validates container and codec compatibility.
    Returns: (safe_extension, was_changed, explanation)
    """
    clean_ext = video_ext.lower().lstrip(".")

    if clean_ext in ("mp4", "mkv", "mov"):
        if clean_ext == "mp4" and not is_reencode and audio_codec in ("flac", "vorbis"):
            return "mkv", True, f"Stream-copying {audio_codec.upper()} in MP4 container is unsupported. Switched to MKV container."
        return clean_ext, False, ""

    if is_reencode:
        return "mp4", True, f"Re-encoding with modern H.264/AAC standardizes onto MP4 container rather than legacy .{clean_ext}."

    if clean_ext == "webm":
        return "webm", False, ""

    return "mp4", True, f"Container .{clean_ext} has limited cross-platform compatibility. Defaulted to .mp4."


def expand_naming_pattern(
    template: str,
    audio_filename: str,
    video_filename: str,
    video_ext: str,
    index: int = 1,
    resolution: str = "original",
    preset: str = "default",
    date_str: Optional[str] = None,
) -> str:
    """Expands template tokens into formatted filename."""
    audio_base = re.sub(r"\.[^/.]+$", "", audio_filename)
    video_base = re.sub(r"\.[^/.]+$", "", video_filename)
    clean_ext = video_ext.lstrip(".")
    date_val = date_str or datetime.datetime.now().strftime("%Y%m%d")

    result = template
    result = result.replace("{audio_name}", audio_base)
    result = result.replace("{video_name}", video_base)
    result = result.replace("{video_ext}", clean_ext)
    result = result.replace("{index}", f"{index:03d}")
    result = result.replace("{date}", date_val)
    result = result.replace("{resolution}", resolution)
    result = result.replace("{preset}", preset)

    # Ensure extension is present
    if not re.search(r"\.[a-zA-Z0-9]+$", result):
        result = f"{result}.{clean_ext}"

    return sanitize_filename(result)


def resolve_batch_collisions(
    target_names: List[str],
    policy: str = "suffix",
    existing_files: Optional[Set[str]] = None,
) -> List[Tuple[str, bool, str]]:
    """
    Applies collision policy (suffix, skip, overwrite) to batch of output filenames.
    Returns: List of (final_filename, is_skipped, note)
    """
    existing = set(existing_files or set())
    seen: Dict[str, int] = {}
    results: List[Tuple[str, bool, str]] = []

    for name in target_names:
        count = seen.get(name, 0)
        on_disk = name in existing

        if count > 0 or on_disk:
            if policy == "skip":
                results.append((name, True, f"Skipped: Output name '{name}' conflicts with existing file or batch entry."))
                continue
            elif policy == "suffix":
                match = re.search(r"\.[^.]+$", name)
                ext = match.group(0) if match else ""
                base = name[:-len(ext)] if ext else name
                suffix_num = count + 1 if count > 0 else 2
                candidate = f"{base} ({suffix_num}){ext}"
                while candidate in seen or candidate in existing:
                    suffix_num += 1
                    candidate = f"{base} ({suffix_num}){ext}"
                seen[name] = count + 1
                seen[candidate] = 1
                results.append((candidate, False, f"Auto-suffixed to avoid collision."))
                continue
            else:  # overwrite
                seen[name] = count + 1
                results.append((name, False, "Will overwrite existing target file."))
                continue

        seen[name] = 1
        results.append((name, False, ""))

    return results
