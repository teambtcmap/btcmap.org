# Second-pass verification for the AI health review, run after
# validate_findings.py. The review is one completion with no tools, so it
# can only reason about the code it was sent; on 2026-10-15 (#1535) most
# wrong findings were refuted by a caller, a guard or a header comment the
# model never saw or overlooked. Each finding names the files that would
# settle it (**Files:** + **Verify with:**); this script reads them from the
# checkout and asks a second completion to refute each finding against them.
#
# Refuted findings move to a collapsed block with the reason, so a human can
# still overrule the pass; the rest get a **Second pass:** line. A failed
# call publishes the report unverified, with a note saying so.
#
# Only git-tracked files are read: the repository is public, so the pass can
# send nothing that isn't already published (.git/config, where checkout
# keeps its token, is not tracked).
#
# Reads and rewrites {TMP}/review.md. TMP defaults to /tmp; override with
# HEALTH_REVIEW_TMP for testing.
import json
import os
import re
import subprocess
import sys
import urllib.request
from collections.abc import Callable

from findings_blocks import split_blocks

TMP = os.environ.get("HEALTH_REVIEW_TMP", "/tmp")
MODEL = os.environ.get("HEALTH_REVIEW_MODEL", "claude-opus-5")
API_URL = "https://api.ppq.ai/chat/completions"

MAX_FILES_PER_FINDING = 4
MAX_FILE_BYTES = 40_000
MAX_TOTAL_BYTES = 240_000

# The marker validate_findings.py opens its collapsed block with
VALIDATOR_DETAILS = "<details>\n<summary>⚠️"

SYSTEM_PROMPT = """You verify code-review findings against the current source of a SvelteKit web application.

For each numbered finding, read the provided files and try to refute it. Answer:
- "refuted": the files show the claim is false, e.g. a guard, early return, caller or existing comment makes the described failure impossible or the described gap already handled; or the finding itself concedes the code is correct, intended or acceptable.
- "confirmed": the files show the failure or gap exists as described.
- "unsure": the provided files do not settle it.

Use only the provided files and never assume what code you were not shown contains. A file marked as truncated says nothing about its omitted part.

Reply with only a JSON array, one entry per finding:
[{"id": 1, "verdict": "refuted", "reason": "<one sentence naming the code that settles it>"}]"""

files_re = re.compile(r"\*\*Files?:\*\*\s*(.+)")
verify_re = re.compile(r"\*\*Verify with:\*\*\s*(.+)")
path_re = re.compile(r"`([^`]+)`")


def finding_paths(block: str) -> list[str]:
    paths: list[str] = []
    for line_re in (files_re, verify_re):
        m = line_re.search(block)
        if not m:
            continue
        for p in path_re.findall(m.group(1)):
            p = p.strip()
            if p and p not in paths:
                paths.append(p)
    return paths[:MAX_FILES_PER_FINDING]


def tracked_files() -> set[str]:
    out = subprocess.run(
        ["git", "ls-files", "-z"], check=True, capture_output=True, text=True
    ).stdout
    return set(filter(None, out.split("\0")))


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


# Files in finding order, so a budget cut costs the last findings their
# context rather than every finding a little
def collect_files(
    per_finding: list[list[str]],
    tracked: set[str],
    read: Callable[[str], str] = read_file,
) -> dict[str, str]:
    files: dict[str, str] = {}
    total = 0
    for paths in per_finding:
        for path in paths:
            if path in files or path not in tracked:
                continue
            if total >= MAX_TOTAL_BYTES:
                return files
            try:
                content = read(path)
            except OSError:
                continue
            if len(content) > MAX_FILE_BYTES:
                content = (
                    content[:MAX_FILE_BYTES]
                    + f"\n[truncated: first {MAX_FILE_BYTES} of {len(content)} bytes shown]\n"
                )
            files[path] = content
            total += len(content)
    return files


def build_user_prompt(findings: list[str], files: dict[str, str]) -> str:
    parts = ["<findings>"]
    for i, block in enumerate(findings, 1):
        parts.append(f'<finding id="{i}">\n{block}\n</finding>')
    parts.append("</findings>\n\n<files>")
    for path, content in files.items():
        parts.append(f'<file path="{path}">\n{content}\n</file>')
    parts.append("</files>")
    if not files:
        parts.append("(None of the named files could be read.)")
    return "\n".join(parts)


def parse_verdicts(text: str) -> dict[int, tuple[str, str]]:
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if not m:
        return {}
    try:
        entries = json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}
    verdicts: dict[int, tuple[str, str]] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        fid, verdict = entry.get("id"), entry.get("verdict")
        if isinstance(fid, int) and verdict in ("refuted", "confirmed", "unsure"):
            verdicts[fid] = (verdict, str(entry.get("reason") or "").strip())
    return verdicts


def complete_ppq(system: str, user: str) -> str:
    request = urllib.request.Request(
        API_URL,
        data=json.dumps({
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            # A ceiling for reasoning + answer together (see #1248)
            "max_tokens": 16000,
        }).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['PPQ_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        data = json.load(response)
    content = data["choices"][0]["message"].get("content")
    if not content:
        raise RuntimeError(f"no content (finish_reason: {data['choices'][0].get('finish_reason')})")
    return content


def with_note(block: str, verdict: tuple[str, str] | None) -> str:
    if verdict is None:
        return f"{block}\n\n**Second pass:** no verdict"
    name, reason = verdict
    return f"{block}\n\n**Second pass:** {name}" + (f" — {reason}" if reason else "")


def verify_report(
    review: str,
    complete: Callable[[str, str], str],
    tracked: set[str],
    read: Callable[[str], str] = read_file,
) -> str:
    m = re.search(r"(## Findings\s*\n)(.*?)(\n##\s+\S)", review, re.DOTALL)
    if not m:
        return review
    body = m.group(2)
    main, sep, details = body.partition(VALIDATOR_DETAILS)
    blocks = split_blocks(main)
    findings = [b for b in blocks if b.strip().startswith("###")]
    if not findings:
        return review

    files = collect_files([finding_paths(f) for f in findings], tracked, read)
    try:
        verdicts = parse_verdicts(
            complete(SYSTEM_PROMPT, build_user_prompt(findings, files))
        )
        failure = None
    except Exception as error:  # the report still publishes, marked unverified
        verdicts, failure = {}, error

    kept: list[str] = []
    refuted: list[str] = []
    index = 0
    for block in blocks:
        if not block.strip().startswith("###"):
            kept.append(block)
            continue
        index += 1
        verdict = verdicts.get(index)
        if failure is not None:
            kept.append(block)
        elif verdict and verdict[0] == "refuted":
            refuted.append(f"{block}\n\n_Refuted: {verdict[1] or 'no reason given'}_")
        else:
            kept.append(with_note(block, verdict))

    new_main = "\n\n---\n\n".join(kept).strip() + "\n\n"
    if failure is not None:
        new_main += f"_Verification pass did not run ({failure}); findings above are unverified._\n\n"
    elif not any(b.strip().startswith("###") for b in kept):
        new_main += "_All findings were refuted by the verification pass._\n\n"
    if refuted:
        new_main += (
            "<details>\n<summary>"
            f"{len(refuted)} finding(s) refuted by the verification pass "
            "— shown for human review</summary>\n\n"
            + "\n\n---\n\n".join(refuted)
            + "\n\n</details>\n\n"
        )
    new_body = new_main + (sep + details if sep else "")
    return review[:m.start(2)] + new_body + review[m.end(2):]


def main() -> None:
    path = f"{TMP}/review.md"
    with open(path, "r", encoding="utf-8") as f:
        review = f.read()
    if not os.environ.get("PPQ_API_KEY"):
        print("::warning title=Health review verifier::PPQ_API_KEY unset, skipping the verification pass")
        return
    result = verify_report(review, complete=complete_ppq, tracked=tracked_files())
    with open(path, "w", encoding="utf-8") as f:
        f.write(result)
    if "Verification pass did not run" in result:
        print("::warning title=Health review verifier::Verification call failed; report published unverified")
    print(f"Refuted: {result.count('_Refuted: ')}, kept with a note: {result.count('**Second pass:**')}")


if __name__ == "__main__":
    sys.exit(main())
