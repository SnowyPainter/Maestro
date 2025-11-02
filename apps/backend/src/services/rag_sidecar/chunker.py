from __future__ import annotations

import math
import re
from typing import Iterable, List, Sequence

DEFAULT_CHUNK_SIZE = 420  # approximate tokens using characters

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_paragraphs(sections: Iterable[str]) -> list[str]:
    cleaned: list[str] = []
    for section in sections:
        if not section:
            continue
        text = _WHITESPACE_RE.sub(" ", section).strip()
        if text:
            cleaned.append(text)
    return cleaned


def chunk_sections(
    sections: Sequence[str],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> list[str]:
    """
    Split sections into roughly chunk_size character windows without
    splitting words when possible.
    """
    normalized = normalize_paragraphs(sections)
    if not normalized:
        return []

    chunks: list[str] = []
    for paragraph in normalized:
        if len(paragraph) <= chunk_size:
            chunks.append(paragraph)
            continue

        words = paragraph.split(" ")
        buffer: list[str] = []
        current_len = 0

        for word in words:
            word_len = len(word)
            # include space if buffer already has content
            projected = current_len + (1 if buffer else 0) + word_len
            if projected > chunk_size and buffer:
                chunks.append(" ".join(buffer))
                buffer = [word]
                current_len = word_len
            else:
                if buffer:
                    current_len += 1  # space
                buffer.append(word)
                current_len += word_len

        if buffer:
            chunks.append(" ".join(buffer))

    # Ensure deterministic chunk count (avoid overly small tail chunks)
    merged: list[str] = []
    for chunk in chunks:
        if not merged:
            merged.append(chunk)
            continue
        if len(chunk) < chunk_size * 0.35 and len(merged[-1]) < chunk_size * 0.5:
            merged[-1] = f"{merged[-1]} {chunk}".strip()
        else:
            merged.append(chunk)
    return merged
