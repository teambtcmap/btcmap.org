# Per-file truncation for the AI health review's diff budget, instead of
# head -c on the whole stream. The old cut was ordered by git's file listing,
# so everything after byte 150000 was invisible with no trace — on 2026-08-15
# the model silently saw 28% of a 540KB period. Every file's diff appears
# (capped per file), and files that still don't fit are listed in a coverage
# manifest the model can see.
#
# Reads {TMP}/raw-diff.txt; writes {TMP}/diff.txt and {TMP}/pipeline-stats.txt.
# TMP defaults to /tmp; override with HEALTH_REVIEW_TMP for testing.
import os
import re

TMP = os.environ.get("HEALTH_REVIEW_TMP", "/tmp")
MAX_TOTAL = 150_000
MAX_PER_FILE = 15_000

with open(f"{TMP}/raw-diff.txt", encoding="utf-8", errors="replace") as f:
    raw = f.read()

chunks = [c for c in re.split(r"(?=^diff --git )", raw, flags=re.M) if c.strip()]

# Adaptive cap: a small period should not be truncated while most of the
# total budget goes unused (the 2026-08-15 follow-up run cut 1.4KB off the
# sole changed file with 135KB of budget spare). Every file gets an equal
# share of the budget, floored at the base cap.
per_file = max(MAX_PER_FILE, MAX_TOTAL // max(len(chunks), 1))

out, omitted, truncated, shown = [], [], 0, 0
for chunk in chunks:
    m = re.match(r"diff --git a/.* b/(\S+)", chunk)
    path = m.group(1) if m else "?"
    piece = chunk
    if len(piece) > per_file:
        piece = piece[:per_file] + (
            f"\n... [diff for {path} truncated: {len(chunk)} bytes total]\n"
        )
    if shown + len(piece) > MAX_TOTAL:
        omitted.append(f"{path} ({len(chunk)} bytes)")
        continue
    if piece is not chunk:
        truncated += 1
    out.append(piece)
    shown += len(piece)

manifest = ""
if truncated or omitted:
    manifest = "\n=== DIFF COVERAGE ===\n"
    if truncated:
        manifest += f"{truncated} file diff(s) above were truncated to {per_file} bytes each.\n"
    if omitted:
        manifest += (
            f"{len(omitted)} file diff(s) did not fit the {MAX_TOTAL}-byte budget and are "
            "NOT shown — do not report findings about them:\n"
            + "\n".join(f"  - {o}" for o in omitted)
            + "\n"
        )

with open(f"{TMP}/diff.txt", "w", encoding="utf-8") as f:
    f.write("".join(out) + manifest)

with open(f"{TMP}/pipeline-stats.txt", "w", encoding="utf-8") as f:
    f.write(
        f"diff: {len(raw)} bytes across {len(chunks)} files; {shown} bytes shown "
        f"(per-file cap {per_file}); {truncated} file(s) truncated; "
        f"{len(omitted)} file(s) omitted entirely\n"
    )
