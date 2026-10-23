"""
Auto-pairing engine supporting 6 modes with fuzzy name confidence and deterministic PRNG.
"""

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple


def normalize_for_fuzzy_match(filename: str) -> str:
    """Normalizes base filename: removes track numbers, symbols, and excess spaces."""
    base = re.sub(r"\.[^/.]+$", "", filename)
    # Strip leading track prefix like "01 - ", "1. ", "track_01_"
    cleaned = re.sub(r"^(?:track\s*[-_]?\s*|\d+[\s._-]+)+", "", base, flags=re.IGNORECASE)
    cleaned = re.sub(r"[._\-+()\[\]]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip().lower()
    return cleaned


def calculate_fuzzy_confidence(s1: str, s2: str) -> float:
    """Calculates Jaccard token overlap + substring similarity (0.0 to 1.0)."""
    n1 = normalize_for_fuzzy_match(s1)
    n2 = normalize_for_fuzzy_match(s2)
    if n1 == n2:
        return 1.0
    if not n1 or not n2:
        return 0.0

    t1 = set(n1.split())
    t2 = set(n2.split())
    intersection = len(t1.intersection(t2))
    union = len(t1.union(t2))
    jaccard = intersection / union if union > 0 else 0.0

    if n1 in n2 or n2 in n1:
        return max(jaccard, 0.85)

    return jaccard


class AutoPairingEngine:
    """Generates pairing plans between audio files and video clips."""

    @staticmethod
    def pair(
        audio_files: List[Any],
        video_files: List[Any],
        mode: str = "cycle",
        single_video_id: Optional[str] = None,
        seed: int = 42,
        fuzzy_threshold: float = 0.65,
    ) -> Dict[str, Any]:
        """
        Executes chosen pairing mode:
        'match_name', 'order_1_to_1', 'one_for_all', 'cycle', 'random_seeded', 'manual'
        """
        pairings: List[Dict[str, Any]] = []
        unmatched_audio: List[Any] = []
        unmatched_video: List[Any] = []
        warnings: List[str] = []

        if not audio_files:
            warnings.append("No audio files provided.")
            return {
                "pairings": [],
                "unmatched_audio": [],
                "unmatched_video": video_files,
                "warnings": warnings,
            }
        if not video_files:
            warnings.append("No video clips provided.")
            return {
                "pairings": [],
                "unmatched_audio": audio_files,
                "unmatched_video": [],
                "warnings": warnings,
            }

        if mode == "match_name":
            used_video_indices: Set[int] = set()

            for a_idx, audio in enumerate(audio_files):
                a_name = audio.filename if hasattr(audio, "filename") else audio["filename"]
                a_norm = normalize_for_fuzzy_match(a_name)
                best_idx = -1
                best_score = 0.0

                # 1. Exact match pass
                for v_idx, video in enumerate(video_files):
                    if v_idx in used_video_indices:
                        continue
                    v_name = video.filename if hasattr(video, "filename") else video["filename"]
                    if a_norm == normalize_for_fuzzy_match(v_name):
                        best_idx = v_idx
                        best_score = 1.0
                        break

                # 2. Fuzzy match pass
                if best_idx == -1:
                    for v_idx, video in enumerate(video_files):
                        if v_idx in used_video_indices:
                            continue
                        v_name = video.filename if hasattr(video, "filename") else video["filename"]
                        score = calculate_fuzzy_confidence(a_name, v_name)
                        if score > best_score and score >= fuzzy_threshold:
                            best_score = score
                            best_idx = v_idx

                if best_idx != -1:
                    used_video_indices.add(best_idx)
                    v_match = video_files[best_idx]
                    pairings.append({
                        "id": f"pair_{len(pairings)}",
                        "audio": audio,
                        "video": v_match,
                        "confidence": best_score,
                    })
                else:
                    unmatched_audio.append(audio)

            for v_idx, video in enumerate(video_files):
                if v_idx not in used_video_indices:
                    unmatched_video.append(video)

            if unmatched_audio:
                warnings.append(f"{len(unmatched_audio)} audio file(s) had no matching video clip by name.")
            if unmatched_video:
                warnings.append(f"{len(unmatched_video)} video clip(s) were not matched by any audio file.")

        elif mode == "order_1_to_1":
            min_len = min(len(audio_files), len(video_files))
            for i in range(min_len):
                pairings.append({
                    "id": f"pair_{i}",
                    "audio": audio_files[i],
                    "video": video_files[i],
                    "confidence": 1.0,
                })
            unmatched_audio.extend(audio_files[min_len:])
            unmatched_video.extend(video_files[min_len:])

            if len(audio_files) > len(video_files):
                warnings.append(
                    f"More audio ({len(audio_files)}) than video ({len(video_files)}). "
                    f"Last {len(unmatched_audio)} audio file(s) remain unmatched. Consider 'Cycle' mode."
                )
            elif len(video_files) > len(audio_files):
                warnings.append(
                    f"More video ({len(video_files)}) than audio ({len(audio_files)}). "
                    f"{len(unmatched_video)} video clip(s) remain unused."
                )

        elif mode == "one_for_all":
            selected = video_files[0]
            if single_video_id:
                for v in video_files:
                    path_str = str(v.path if hasattr(v, "path") else v.get("path", ""))
                    if path_str == single_video_id:
                        selected = v
                        break

            for i, audio in enumerate(audio_files):
                pairings.append({
                    "id": f"pair_{i}",
                    "audio": audio,
                    "video": selected,
                    "confidence": 1.0,
                })

            for v in video_files:
                if v != selected:
                    unmatched_video.append(v)

        elif mode == "cycle":
            for i, audio in enumerate(audio_files):
                video = video_files[i % len(video_files)]
                pairings.append({
                    "id": f"pair_{i}",
                    "audio": audio,
                    "video": video,
                    "confidence": 1.0,
                })
            if len(video_files) > len(audio_files):
                unmatched_video.extend(video_files[len(audio_files):])
                warnings.append(f"{len(unmatched_video)} video clip(s) were not reached in the cycle sequence.")

        elif mode == "random_seeded":
            # Deterministic Linear Congruential Generator
            current_seed = seed
            def next_rand():
                nonlocal current_seed
                current_seed = (current_seed * 1664525 + 1013904223) % 4294967296
                return current_seed / 4294967296.0

            last_idx = -1
            for i, audio in enumerate(audio_files):
                v_idx = int(next_rand() * len(video_files))
                if len(video_files) > 1 and v_idx == last_idx:
                    v_idx = (v_idx + 1) % len(video_files)
                last_idx = v_idx
                pairings.append({
                    "id": f"pair_{i}",
                    "audio": audio,
                    "video": video_files[v_idx],
                    "confidence": 1.0,
                })

        else:  # manual / fallback
            min_len = min(len(audio_files), len(video_files))
            for i in range(min_len):
                pairings.append({
                    "id": f"pair_{i}",
                    "audio": audio_files[i],
                    "video": video_files[i],
                    "confidence": 1.0,
                })
            unmatched_audio.extend(audio_files[min_len:])
            unmatched_video.extend(video_files[min_len:])

        return {
            "pairings": pairings,
            "unmatched_audio": unmatched_audio,
            "unmatched_video": unmatched_video,
            "warnings": warnings,
        }
