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
# Tests are the least review-worthy bytes per finding and the most numerous
# files in a feature-heavy period; once the budget is contested they get a
# tighter cap so they stay visible without crowding out the source they test.
MAX_PER_TEST_FILE = 5_000

TEST_RE = re.compile(r"\.(test|spec)\.[cm]?[jt]sx?$")

# Budget tiers, filled in this order once the diff exceeds MAX_TOTAL. git
# emits file diffs in path order, so first-come-first-served spent the
# 2026-09-01 budget on .github/, the docs, src/components and src/lib/<a–m>
# and omitted all 43 src/routes files plus every Playwright spec — a
# deterministic blind spot, not a random one. App source outranks the
# pipeline's own files (the workflow is sent in full via <review-pipeline>
# regardless), which outrank tests. Git order is kept inside each tier.
TIER_ORDER = ("app", ".github", "tests")


def tier(path: str) -> str:
    if TEST_RE.search(path) or path.startswith("tests/"):
        return "tests"
    if path.startswith(".github/"):
        return ".github"
    return "app"


with open(f"{TMP}/raw-diff.txt", encoding="utf-8", errors="replace") as f:
    raw = f.read()

chunks = [c for c in re.split(r"(?=^diff --git )", raw, flags=re.M) if c.strip()]


def path_of(chunk: str) -> str:
    m = re.match(r"diff --git a/.* b/(\S+)", chunk)
    return m.group(1) if m else "?"


files = [(path_of(c), c) for c in chunks]

# A period that fits is shown whole, in git order, with no per-file cap —
# truncating a 20KB file while 100KB of budget goes unused helps nobody.
over_budget = len(raw) > MAX_TOTAL
if over_budget:
    files.sort(key=lambda pc: TIER_ORDER.index(tier(pc[0])))

# Adaptive cap: a period of a few huge files should not be cut to 15KB each
# while most of the budget goes unused. Every file gets an equal share of
# the budget, floored at the base cap.
per_file = max(MAX_PER_FILE, MAX_TOTAL // max(len(chunks), 1))
test_cap = min(per_file, MAX_PER_TEST_FILE)

out, omitted, truncated, shown = [], [], 0, 0
for path, chunk in files:
    cap = test_cap if tier(path) == "tests" else per_file
    piece = chunk
    if over_budget and len(piece) > cap:
        piece = piece[:cap] + (
            f"\n... [diff for {path} truncated: {len(chunk)} bytes total]\n"
        )
    if shown + len(piece) > MAX_TOTAL:
        omitted.append(path)
        continue
    if piece is not chunk:
        truncated += 1
    out.append(piece)
    shown += len(piece)

sizes = {p: len(c) for p, c in files}
omitted_by_tier = {t: sum(1 for p in omitted if tier(p) == t) for t in TIER_ORDER}

manifest = ""
if truncated or omitted:
    manifest = "\n=== DIFF COVERAGE ===\n"
    if truncated:
        manifest += (
            f"{truncated} file diff(s) above were truncated "
            f"(app/.github to {per_file} bytes, tests to {test_cap} bytes).\n"
        )
    if omitted:
        manifest += (
            f"{len(omitted)} file diff(s) did not fit the {MAX_TOTAL}-byte budget — "
            "diff not shown. Report on them only where their complete current "
            "contents appear in <file-contents>; never guess at what changed:\n"
            + "\n".join(f"  - {p} ({sizes[p]} bytes)" for p in omitted)
            + "\n"
        )

with open(f"{TMP}/diff.txt", "w", encoding="utf-8") as f:
    f.write("".join(out) + manifest)

with open(f"{TMP}/pipeline-stats.txt", "w", encoding="utf-8") as f:
    f.write(
        f"diff: {len(raw)} bytes across {len(chunks)} files; {shown} bytes shown "
        f"(per-file cap {per_file}, tests {test_cap}"
        + ("; budget order app > .github > tests" if over_budget else "")
        + f"); {truncated} file(s) truncated; "
        f"{len(omitted)} file(s) omitted entirely ("
        + ", ".join(f"{t} {n}" for t, n in omitted_by_tier.items())
        + ")\n"
    )
