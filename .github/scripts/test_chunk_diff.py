# Unit tests for chunk_diff.py. Run from the repo root:
#   python3 -m unittest discover -s .github/scripts -p 'test_*.py'
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / ".github" / "scripts" / "chunk_diff.py"
MANIFEST = "=== DIFF COVERAGE ==="


def file_diff(path: str, size: int) -> str:
    header = f"diff --git a/{path} b/{path}\n--- a/{path}\n+++ b/{path}\n@@ -1 +1 @@\n"
    line = "+" + "x" * 78 + "\n"
    return header + line * max(1, (size - len(header)) // len(line))


def run(chunks: list[str]) -> tuple[str, str]:
    tmp = tempfile.mkdtemp()
    (Path(tmp) / "raw-diff.txt").write_text("".join(chunks), encoding="utf-8")
    subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=REPO,
        check=True,
        capture_output=True,
        env={**os.environ, "HEALTH_REVIEW_TMP": tmp},
    )
    diff = (Path(tmp) / "diff.txt").read_text(encoding="utf-8")
    stats = (Path(tmp) / "pipeline-stats.txt").read_text(encoding="utf-8")
    return diff, stats


def shown_paths(diff: str) -> list[str]:
    return re.findall(r"^diff --git a/\S+ b/(\S+)$", diff.split(MANIFEST)[0], flags=re.M)


def omitted_paths(diff: str) -> list[str]:
    if MANIFEST not in diff:
        return []
    return re.findall(r"^  - (\S+) \(", diff.split(MANIFEST)[1], flags=re.M)


def shown_chunk(diff: str, path: str) -> str:
    for chunk in re.split(r"(?=^diff --git )", diff.split(MANIFEST)[0], flags=re.M):
        if chunk.startswith(f"diff --git a/{path} "):
            return chunk
    raise AssertionError(f"{path} is not in the shown diff")


def is_test(path: str) -> bool:
    return (
        bool(re.search(r"\.(test|spec)\.[cm]?[jt]sx?$", path))
        or bool(re.search(r"(?:^|/)test_[^/]+\.py$", path))
        or path.startswith("tests/")
    )


# Alphabetical (git) order is deliberately adverse: .github and the
# src/lib/*.test.ts files sort before src/routes, and the whole set
# (~1.4MB raw, ~400KB at the caps) far exceeds the budget — the
# 2026-09-01 shape that omitted every src/routes file.
APP = [
    "src/components/Foo.svelte",
    "src/lib/zz.ts",
    "src/routes/add-location/+page.svelte",
    "src/routes/map/+page.svelte",
]
GITHUB = [".github/scripts/chunk_diff.py", ".github/workflows/ai-health-review.yml"]
TESTS = [f"src/lib/t{i:02d}.test.ts" for i in range(60)] + [
    "tests/a.spec.ts",
    "tests/b.spec.ts",
    "tests/c.spec.ts",
    # Python test module: this pipeline's own tests live under
    # .github/scripts/, and the tests tier must outrank the .github tier
    # for them too.
    ".github/scripts/test_helpers.py",
]
OVER_BUDGET = [
    file_diff(p, 40_000 if p == "src/routes/map/+page.svelte" else 20_000)
    for p in sorted(APP + GITHUB + TESTS)
]


class OverBudget(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.diff, cls.stats = run(OVER_BUDGET)
        cls.shown = shown_paths(cls.diff)

    def test_orders_app_source_then_github_then_tests(self):
        idx = {p: i for i, p in enumerate(self.shown)}
        app = [idx[p] for p in APP]
        github = [idx[p] for p in GITHUB]
        tests = [idx[p] for p in TESTS if p in idx]
        self.assertTrue(tests, "some test diffs should still fit")
        self.assertLess(max(app), min(github))
        self.assertLess(max(github), min(tests))

    def test_omits_tests_before_app_source(self):
        omitted = omitted_paths(self.diff)
        self.assertTrue(omitted, "fixture must exceed the budget")
        self.assertTrue(all(is_test(p) for p in omitted), omitted)
        for p in APP:
            self.assertIn(p, self.shown)

    def test_caps_test_diffs_tighter_than_app_source(self):
        app_chunk = shown_chunk(self.diff, "src/routes/map/+page.svelte")
        test_chunk = shown_chunk(self.diff, TESTS[0])
        self.assertGreaterEqual(len(app_chunk), 15_000)
        self.assertIn("[diff for src/routes/map/+page.svelte truncated: ", app_chunk)
        self.assertLess(len(test_chunk), 6_000)
        self.assertIn(f"[diff for {TESTS[0]} truncated: ", test_chunk)

    def test_python_test_modules_take_the_test_cap(self):
        chunk = shown_chunk(self.diff, ".github/scripts/test_helpers.py")
        self.assertLess(len(chunk), 6_000)
        self.assertIn("[diff for .github/scripts/test_helpers.py truncated: ", chunk)

    def test_manifest_defers_to_file_contents_instead_of_forbidding(self):
        manifest = self.diff.split(MANIFEST)[1]
        self.assertNotIn("do not report findings about them", manifest)
        self.assertIn("<file-contents>", manifest)

    def test_stats_break_omissions_down_by_tier(self):
        self.assertRegex(
            self.stats,
            r"omitted entirely \(app 0, \.github 0, tests \d+\)",
        )


class WithinBudget(unittest.TestCase):
    def test_keeps_git_order_and_truncates_nothing(self):
        paths = sorted(GITHUB + APP + TESTS[:5] + ["tests/big.spec.ts"])
        chunks = [
            file_diff(p, 20_000 if p == "tests/big.spec.ts" else 8_000) for p in paths
        ]
        diff, stats = run(chunks)
        self.assertEqual(shown_paths(diff), paths)
        self.assertNotIn(MANIFEST, diff)
        big = next(c for c in chunks if c.startswith("diff --git a/tests/big.spec.ts "))
        self.assertEqual(shown_chunk(diff, "tests/big.spec.ts"), big)
        self.assertIn("0 file(s) truncated", stats)


if __name__ == "__main__":
    unittest.main()
