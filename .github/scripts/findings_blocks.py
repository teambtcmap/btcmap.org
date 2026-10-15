# Splits a health review's ## Findings section into finding blocks; shared
# by validate_findings.py and verify_findings.py.
import re


# The schema separates findings with a bare `---` line, but a **Quote:**
# fence can legitimately contain one (YAML documents, markdown, this
# pipeline's own prompt schema) and a model occasionally forgets the
# separator altogether. A naive split tore such a finding in two: the
# first half failed the quote check, the orphaned second half had no
# `###` and was kept unvalidated. So the split is fence-aware and also
# starts a new block at every `### ` heading. Separators are consumed
# here and re-emitted on rejoin, so no block carries one.
def split_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    fence: str | None = None

    def flush() -> None:
        if "".join(current).strip():
            blocks.append("\n".join(current).strip())
        current.clear()

    for line in text.splitlines():
        s = line.strip()
        if fence is None and (s.startswith("```") or s.startswith("~~~")):
            fence = s[:3]
        elif fence is not None and s.startswith(fence):
            fence = None
        elif fence is None:
            if re.fullmatch(r"-{3,}", s):
                flush()
                continue
            if s.startswith("### "):
                flush()
        current.append(line)
    flush()
    return blocks
