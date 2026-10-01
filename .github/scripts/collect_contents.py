# Full current contents of the period's changed and imported files, for the
# AI health review's <file-contents> block. Candidates arrive pre-ordered
# by the workflow (server .ts, .ts, .svelte, the rest). The period's
# app-source hotspots move to the front, busiest first, up to
# HOTSPOT_SHARE of the budget; the rest keep the workflow's order. Unbounded
# and unfiltered, the boost let spec files, package.json and a 64KB page
# crowd out every +server.ts route on a replay of the 2026-10-01 period.
#
# A file over MAX_FILE used to be skipped outright, which on 2026-10-01 hid
# the period's most-changed file (AddLocationForm.svelte, 40KB, 15 commits)
# entirely. A hotspot over the cap now gets a head-and-tail window instead
# (whole lines, the middle marked); other oversized files are still skipped.
#
# Reads {TMP}/context-files.txt and {TMP}/hotspots.txt; writes
# {TMP}/file-contents.txt and appends a line to {TMP}/pipeline-stats.txt.
# Paths are relative to the working directory (the repo root in CI).
# TMP defaults to /tmp; override with HEALTH_REVIEW_TMP for testing.
import os

from hotspots import hotspot_rank

TMP = os.environ.get("HEALTH_REVIEW_TMP", "/tmp")
MAX_CONTEXT = 120_000
# At 20000 the period's most-changed file was skipped from context (#1253).
MAX_FILE = 32_000
# Imports and the render logic sit at the top, so the head gets more.
HEAD_SHARE = 2 / 3
HOTSPOT_SHARE = 1 / 2


def is_app_source(path: str) -> bool:
    return path.startswith("src/") and ".test." not in path and ".spec." not in path


def window(path: str, text: str) -> str:
    lines = text.splitlines(keepends=True)
    head, size = [], 0
    for line in lines:
        if size + len(line) > MAX_FILE * HEAD_SHARE:
            break
        head.append(line)
        size += len(line)
    tail, size = [], 0
    for line in reversed(lines[len(head) :]):
        if size + len(line) > MAX_FILE * (1 - HEAD_SHARE):
            break
        tail.insert(0, line)
        size += len(line)
    first, last = len(head) + 1, len(lines) - len(tail)
    return (
        "".join(head)
        + f"[... {path}: lines {first}-{last} of {len(lines)} omitted ...]\n"
        + "".join(tail)
    )


def read(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def nbytes(text: str) -> int:
    return len(text.encode("utf-8"))


with open(f"{TMP}/context-files.txt", encoding="utf-8") as f:
    candidates = [line for line in f.read().splitlines() if line]
present = [p for p in candidates if os.path.isfile(p)]

rank = hotspot_rank(TMP)
hot = {p for p in present if p in rank and is_app_source(p)}


def shown(path: str) -> str | None:
    # What the block would carry for this file, or None when it is skipped.
    text = read(path)
    if nbytes(text) <= MAX_FILE:
        return text
    return window(path, text) if path in hot else None


boosted, boost_used = [], 0
for path in sorted(hot, key=rank.__getitem__):
    text = shown(path)
    if text is not None and boost_used + nbytes(text) <= MAX_CONTEXT * HOTSPOT_SHARE:
        boosted.append(path)
        boost_used += nbytes(text)
ordered = boosted + [p for p in present if p not in boosted]

out, total, windowed = [], 0, 0
for path in ordered:
    size = nbytes(read(path))
    text = shown(path)
    if text is None:
        out.append(f"[SKIPPED: {path} ({size} bytes, over per-file limit)]\n")
        continue
    piece = nbytes(text)
    if total + piece > MAX_CONTEXT:
        out.append(f"[SKIPPED: {path} ({size} bytes, context budget exhausted)]\n")
        continue
    header = f"=== {path} ==="
    if size > MAX_FILE:
        header = f"=== {path} (head and tail of {size} bytes, middle omitted) ==="
        windowed += 1
    out.append(f"{header}\n{text}\n\n")
    total += piece

with open(f"{TMP}/file-contents.txt", "w", encoding="utf-8") as f:
    f.write("".join(out))

summary = (
    f"file contents: {total} bytes shown of {len(candidates)} candidate files "
    f"(per-file cap {MAX_FILE}, total budget {MAX_CONTEXT}; "
    f"{len(boosted)} app-source hotspot(s) first, {boost_used} bytes; "
    f"{windowed} hotspot file(s) windowed to head and tail; "
    "skipped files are marked inline)"
)
print(summary)
with open(f"{TMP}/pipeline-stats.txt", "a", encoding="utf-8") as f:
    f.write(summary + "\n")
