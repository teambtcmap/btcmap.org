# Unit tests for verify_findings.py. Run from the repo root:
#   python3 -m unittest discover -s .github/scripts -p 'test_*.py'
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verify_findings as vf  # noqa: E402

REPORT = (
    "# Review\n\n## Summary\nQuiet.\n\n## Findings\n\n{findings}\n\n"
    "## Refactoring Opportunities\n- none\n"
)


def finding(title: str, files: str = "`src/a.ts`", verify: str | None = None) -> str:
    block = (
        f"### LOW: {title}\n"
        f"**Files:** {files}\n"
        "**Quote:**\n```\nconst a = 1;\n```\n"
    )
    if verify is not None:
        block += f"**Verify with:** {verify}\n"
    return block + "Explanation.\n"


def findings_section(review: str) -> str:
    return review.split("## Findings", 1)[1].split("## Refactoring", 1)[0]


def main_body(review: str) -> str:
    return findings_section(review).split("<details>")[0]


class FindingPaths(unittest.TestCase):
    def test_files_then_verify_with_deduplicated(self):
        block = finding("x", "`src/a.ts`", "`src/b.ts`, `src/a.ts`")
        self.assertEqual(vf.finding_paths(block), ["src/a.ts", "src/b.ts"])

    def test_caps_paths_per_finding(self):
        verify = ", ".join(f"`src/{n}.ts`" for n in "bcdef")
        paths = vf.finding_paths(finding("x", "`src/a.ts`", verify))
        self.assertEqual(len(paths), vf.MAX_FILES_PER_FINDING)


class CollectFiles(unittest.TestCase):
    def read(self, path: str) -> str:
        return f"// {path}\n"

    def test_only_tracked_paths_are_read(self):
        files = vf.collect_files(
            [["src/a.ts", ".git/config", "../secret", "/etc/passwd"]],
            tracked={"src/a.ts"},
            read=self.read,
        )
        self.assertEqual(list(files), ["src/a.ts"])

    def test_oversized_file_is_truncated_with_marker(self):
        files = vf.collect_files(
            [["src/a.ts"]],
            tracked={"src/a.ts"},
            read=lambda _p: "x" * (vf.MAX_FILE_BYTES + 10),
        )
        self.assertIn("[truncated", files["src/a.ts"])
        self.assertLess(len(files["src/a.ts"]), vf.MAX_FILE_BYTES + 100)

    def test_total_budget_stops_adding_files(self):
        big = "x" * vf.MAX_FILE_BYTES
        paths = [f"src/{n}.ts" for n in range(20)]
        files = vf.collect_files([paths[i:i + 4] for i in range(0, 20, 4)],
                                 tracked=set(paths), read=lambda _p: big)
        self.assertLessEqual(sum(len(c) for c in files.values()),
                             vf.MAX_TOTAL_BYTES + vf.MAX_FILE_BYTES)
        self.assertLess(len(files), 20)


class ParseVerdicts(unittest.TestCase):
    def test_json_array_inside_a_fence(self):
        text = 'Sure.\n```json\n[{"id": 1, "verdict": "refuted", "reason": "guarded"}]\n```'
        self.assertEqual(vf.parse_verdicts(text), {1: ("refuted", "guarded")})

    def test_unknown_verdicts_and_garbage_are_ignored(self):
        text = '[{"id": 1, "verdict": "maybe"}, {"id": "x"}, {"id": 2, "verdict": "confirmed"}]'
        self.assertEqual(vf.parse_verdicts(text), {2: ("confirmed", "")})

    def test_no_json_returns_nothing(self):
        self.assertEqual(vf.parse_verdicts("no idea"), {})


class Run(unittest.TestCase):
    def run_report(self, review: str, answer: str | Exception) -> str:
        def complete(_system: str, _user: str) -> str:
            if isinstance(answer, Exception):
                raise answer
            return answer

        return vf.verify_report(
            review, complete=complete, tracked={"src/a.ts"}, read=lambda p: "code\n"
        )

    def test_refuted_finding_moves_to_a_collapsed_block(self):
        review = REPORT.format(findings=finding("wrong") + "\n---\n\n" + finding("right"))
        out = self.run_report(
            review,
            '[{"id": 1, "verdict": "refuted", "reason": "the caller guards it"},'
            ' {"id": 2, "verdict": "confirmed", "reason": "no guard"}]',
        )
        self.assertNotIn("### LOW: wrong", main_body(out))
        self.assertIn("### LOW: right", main_body(out))
        self.assertIn("**Second pass:** confirmed — no guard", main_body(out))
        self.assertIn("refuted by the verification pass", findings_section(out))
        self.assertIn("_Refuted: the caller guards it_", findings_section(out))

    def test_unsure_and_missing_verdicts_stay_with_a_note(self):
        review = REPORT.format(findings=finding("a") + "\n---\n\n" + finding("b"))
        out = self.run_report(review, '[{"id": 1, "verdict": "unsure", "reason": "caller not shown"}]')
        self.assertIn("**Second pass:** unsure — caller not shown", main_body(out))
        self.assertIn("**Second pass:** no verdict", main_body(out))

    def test_validator_details_block_is_preserved(self):
        dropped = "<details>\n<summary>⚠️ 1 finding(s) failed automatic verification</summary>\n\nold\n\n</details>"
        review = REPORT.format(findings=finding("a") + "\n\n" + dropped)
        out = self.run_report(review, '[{"id": 1, "verdict": "confirmed", "reason": "ok"}]')
        self.assertIn("failed automatic verification", findings_section(out))
        self.assertIn("### LOW: a", main_body(out))

    def test_api_failure_publishes_unverified_with_a_note(self):
        review = REPORT.format(findings=finding("a"))
        out = self.run_report(review, RuntimeError("HTTP 500"))
        self.assertIn("### LOW: a", main_body(out))
        self.assertIn("Verification pass did not run", main_body(out))

    def test_report_without_findings_is_untouched(self):
        review = REPORT.format(findings="None.")
        self.assertEqual(self.run_report(review, "[]"), review)


if __name__ == "__main__":
    unittest.main()
