# Unit tests for validate_findings.py. Run from the repo root:
#   python3 -m unittest discover -s .github/scripts -p 'test_*.py'
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / ".github" / "scripts" / "validate_findings.py"

REPORT = "# Review\n\n## Summary\nQuiet period.\n\n## Findings\n\n{findings}\n## Refactoring Opportunities\n- none\n"


def finding(title: str, quote: str) -> str:
    return (
        f"### LOW: {title}\n"
        "**Files:** `src/foo.ts`\n"
        "**Quote:**\n"
        f"```\n{quote}\n```\n"
        "Explanation.\n"
    )


def checked(block: str, counter: str) -> str:
    # Adds a **Checked against:** quote after the finding's **Quote:** fence
    head, sep, rest = block.partition("```\nExplanation.")
    return f"{head}```\n**Checked against:**\n```\n{counter}\n```\nExplanation.{rest}"


def run(review: str, corpus: str) -> tuple[str, str]:
    tmp = tempfile.mkdtemp()
    (Path(tmp) / "review.md").write_text(review, encoding="utf-8")
    (Path(tmp) / "diff.txt").write_text(corpus, encoding="utf-8")
    # The Files check accepts paths from the period's diff headers.
    (Path(tmp) / "raw-diff.txt").write_text(
        "diff --git a/src/foo.ts b/src/foo.ts\n" + corpus, encoding="utf-8"
    )
    (Path(tmp) / "file-contents.txt").write_text("", encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, "HEALTH_REVIEW_TMP": tmp},
    )
    return (Path(tmp) / "review.md").read_text(encoding="utf-8"), proc.stdout


def findings_section(review: str) -> str:
    return re.search(r"## Findings\s*\n(.*?)\n## ", review, flags=re.S).group(1)


def main_body(review: str) -> str:
    return findings_section(review).split("<details>")[0]


def separator_lines_outside_fences(text: str) -> int:
    count, in_fence = 0, False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
        elif not in_fence and re.fullmatch(r"-{3,}", line.strip()):
            count += 1
    return count


class SplitFindings(unittest.TestCase):
    def test_separator_inside_quote_fence_keeps_finding_intact(self):
        quote = "steps:\n---\nname: x"
        review = REPORT.format(findings=finding("yaml", quote))
        out, log = run(review, quote + "\n")
        self.assertIn("No findings dropped", log)
        self.assertEqual(out.count("### LOW:"), 1)
        self.assertIn(f"```\n{quote}\n```", out)

    def test_findings_without_separator_are_validated_individually(self):
        review = REPORT.format(
            findings=finding("first", "const a = 1;") + "\n" + finding("second", "made up")
        )
        out, log = run(review, "const a = 1;\n")
        self.assertIn("Dropped 1 finding(s)", log)
        self.assertIn("### LOW: first", main_body(out))
        self.assertNotIn("### LOW: second", main_body(out))
        self.assertIn("### LOW: second", findings_section(out))

    # Baseline guard for the schema's own separators: rejoining must not
    # duplicate them.
    def test_separated_findings_are_rejoined_with_single_separators(self):
        review = REPORT.format(
            findings="\n---\n\n".join(
                finding(t, f"const {t} = 1;") for t in ("a", "b", "c")
            )
        )
        out, log = run(review, "const a = 1;\nconst b = 1;\nconst c = 1;\n")
        self.assertIn("No findings dropped", log)
        self.assertEqual(main_body(out).count("### LOW:"), 3)
        self.assertEqual(separator_lines_outside_fences(main_body(out)), 2)


class CheckedAgainst(unittest.TestCase):
    def test_counter_quote_found_in_inputs_keeps_finding(self):
        review = REPORT.format(
            findings=checked(finding("guarded", "const a = 1;"), "if (!a) return;")
        )
        out, log = run(review, "const a = 1;\nif (!a) return;\n")
        self.assertIn("No findings dropped", log)
        self.assertIn("### LOW: guarded", main_body(out))

    def test_invented_counter_quote_drops_finding(self):
        review = REPORT.format(
            findings=checked(finding("invented", "const a = 1;"), "if (!b) return;")
        )
        out, log = run(review, "const a = 1;\nif (!a) return;\n")
        self.assertIn("Dropped 1 finding(s)", log)
        self.assertIn("**Checked against:** quote not found", log)
        self.assertNotIn("### LOW: invented", main_body(out))

    def test_none_provided_is_accepted(self):
        review = REPORT.format(
            findings=checked(finding("unchecked", "const a = 1;"), "none provided")
        )
        out, log = run(review, "const a = 1;\n")
        self.assertIn("No findings dropped", log)
        self.assertIn("### LOW: unchecked", main_body(out))


if __name__ == "__main__":
    unittest.main()
