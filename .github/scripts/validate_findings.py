# Two-stage finding validation for the AI health review, applied to each
# ### block under ## Findings:
#   1. **Files:** `path` must exist in the working tree
#      (catches invented filenames from import-name guessing)
#   2. **Quote:** ```...``` must appear verbatim in the diff or
#      file contents the model was given
#      (catches misattribution and paraphrased "from memory" claims)
# Findings that fail either check are dropped from the main section but kept
# in a collapsed details block for human review, with a log line explaining
# why so the failure mode is visible in CI history.
#
# Reads and rewrites {TMP}/review.md; corpus comes from {TMP}/diff.txt,
# {TMP}/file-contents.txt and {TMP}/raw-diff.txt. TMP defaults to /tmp;
# override with HEALTH_REVIEW_TMP for testing.
import os
import re
import sys

TMP = os.environ.get("HEALTH_REVIEW_TMP", "/tmp")

path = f"{TMP}/review.md"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()


# Load the model's input corpus once. Normalize whitespace so quote
# matching is robust to indentation drift between source and what
# the model copied (it sometimes trims leading tabs).
def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


corpus_parts = []
for src in (f"{TMP}/diff.txt", f"{TMP}/file-contents.txt"):
    try:
        with open(src, "r", encoding="utf-8", errors="replace") as f:
            corpus_parts.append(f.read())
    except FileNotFoundError:
        pass

# Diff lines carry +/-/space markers. A model copying 2+ lines from
# a hunk omits them, so after whitespace collapsing the corpus can
# never contain the quote — multi-line quotes from added code could
# never verify (both findings dropped on the 2026-08-15 run quoted
# real code). Add a marker-stripped copy of the diff so verbatim
# multi-line quotes match.
try:
    with open(f"{TMP}/diff.txt", "r", encoding="utf-8", errors="replace") as f:
        stripped = "\n".join(
            re.sub(r"^[+\- ]", "", line) for line in f.read().splitlines()
        )
    corpus_parts.append(stripped)
except FileNotFoundError:
    pass

corpus = norm("\n".join(corpus_parts))

# Paths that appear as either side of a `diff --git a/x b/y` header.
# A finding may legitimately reference a deleted or renamed file
# whose path no longer exists on disk; we accept it if the path
# was part of this period's diff. Use the untruncated raw-diff
# when present so this works even on large diffs.
diff_paths: set[str] = set()
diff_header_re = re.compile(r"^diff --git a/(.+?) b/(.+)$", re.MULTILINE)
for src in (f"{TMP}/raw-diff.txt", f"{TMP}/diff.txt"):
    try:
        with open(src, "r", encoding="utf-8", errors="replace") as f:
            diff_text = f.read()
        for ma, mb in diff_header_re.findall(diff_text):
            diff_paths.add(ma)
            diff_paths.add(mb)
        break
    except FileNotFoundError:
        continue

findings_re = re.compile(r"(## Findings\s*\n)(.*?)(\n##\s+\S)", re.DOTALL)
m = findings_re.search(text)
if not m:
    # Surface the silent-pass as a workflow annotation so a
    # malformed AI response doesn't quietly publish unvalidated.
    # Don't hard-fail: a genuinely empty period with no findings
    # is also a valid outcome and shouldn't break the schedule.
    print(
        "::warning title=Health review validator::"
        "Could not locate a '## Findings' section in the AI "
        "response — review was published without file/quote "
        "verification. If the report contains findings, the "
        "output format may have drifted from the prompt schema."
    )
    sys.exit(0)

head, body, tail = m.group(1), m.group(2), m.group(3)

blocks = re.split(r"\n---\s*\n", body.strip())

file_re = re.compile(r"\*\*Files?:\*\*\s*(.+)")
path_re = re.compile(r"`([^`]+)`")
# Match a fenced code block that follows the **Quote:** label.
# Tolerate optional language tag and either ``` or ~~~ fences.
quote_re = re.compile(
    r"\*\*Quote:\*\*\s*\n+(?:```|~~~)[^\n]*\n(.*?)\n(?:```|~~~)",
    re.DOTALL,
)

kept = []
dropped = []
for block in blocks:
    if not block.strip().startswith("###"):
        kept.append(block)
        continue
    title = block.splitlines()[0].strip()

    # 1. File existence
    fm = file_re.search(block)
    if not fm:
        dropped.append((title, "no **Files:** line", block))
        continue
    raw = fm.group(1).strip()
    paths = path_re.findall(raw)
    if not paths:
        paths = [p.strip().rstrip(",") for p in re.split(r"[,\s]+", raw) if p.strip()]
    # A path is OK if it's on disk OR was touched by the period's
    # diff (covers deletes and renames where the cited path is the
    # old name). Anything else is a hallucinated path.
    missing = [
        p for p in paths
        if not os.path.isfile(p) and p not in diff_paths
    ]
    if missing:
        dropped.append((title, f"missing file(s): {', '.join(missing)}", block))
        continue

    # 2. Quote present and verifiable
    qm = quote_re.search(block)
    if not qm:
        dropped.append((title, "no **Quote:** code block", block))
        continue
    quote_norm = norm(qm.group(1))
    if not quote_norm:
        dropped.append((title, "empty **Quote:** block", block))
        continue
    if quote_norm not in corpus:
        preview = quote_norm[:80] + ("…" if len(quote_norm) > 80 else "")
        dropped.append((title, f"quote not found in diff or file-contents: '{preview}'", block))
        continue

    kept.append(block)

new_body = "\n\n---\n\n".join(kept).strip() + "\n\n"

if not any(b.strip().startswith("###") for b in kept):
    new_body += "_All findings were dropped by post-processing (failed file or quote verification)._\n\n"

# Dropped findings previously vanished into the CI log where nobody
# saw them — on 2026-08-15 two real findings were lost that way.
# Keep them human-reviewable in a collapsed block, clearly labeled
# as unverified.
if dropped:
    new_body += (
        "<details>\n<summary>⚠️ "
        f"{len(dropped)} finding(s) failed automatic verification "
        "— shown for human review, may be inaccurate</summary>\n\n"
        + "\n\n---\n\n".join(
            f"{block.strip()}\n\n_Dropped: {reason}_"
            for title, reason, block in dropped
        )
        + "\n\n</details>\n\n"
    )

new_text = text[:m.start()] + head + new_body + tail + text[m.end():]
with open(path, "w", encoding="utf-8") as f:
    f.write(new_text)

if dropped:
    print(f"Dropped {len(dropped)} finding(s):")
    for title, reason, _block in dropped:
        print(f"  - {title}")
        print(f"      reason: {reason}")
else:
    print("No findings dropped — all passed file and quote verification.")
