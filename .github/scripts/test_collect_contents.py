# Unit tests for collect_contents.py. Run from the repo root:
#   python3 -m unittest discover -s .github/scripts -p 'test_*.py'
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "collect_contents.py"


def source(size: int, tag: str) -> str:
    # Numbered lines so the head and tail of a window are recognizable.
    lines, n = [], 0
    while sum(len(line) for line in lines) < size:
        lines.append(f"// {tag} line {n:05d} " + "x" * 60 + "\n")
        n += 1
    return "".join(lines)


def run(files: dict[str, str], candidates: list[str], hotspots: str = "") -> tuple[str, str]:
    tmp = tempfile.mkdtemp()
    repo = Path(tmp) / "repo"
    for path, text in files.items():
        (repo / path).parent.mkdir(parents=True, exist_ok=True)
        (repo / path).write_text(text, encoding="utf-8")
    (Path(tmp) / "context-files.txt").write_text("\n".join(candidates) + "\n", encoding="utf-8")
    (Path(tmp) / "hotspots.txt").write_text(hotspots, encoding="utf-8")
    (Path(tmp) / "pipeline-stats.txt").write_text("diff: stats\n", encoding="utf-8")
    subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=repo,
        check=True,
        capture_output=True,
        env={**os.environ, "HEALTH_REVIEW_TMP": tmp},
    )
    contents = (Path(tmp) / "file-contents.txt").read_text(encoding="utf-8")
    stats = (Path(tmp) / "pipeline-stats.txt").read_text(encoding="utf-8")
    return contents, stats


BIG_HOT = "src/components/add-location/AddLocationForm.svelte"
BIG_COLD = "src/lib/generated.ts"
SMALL = "src/lib/small.ts"


class OverLimit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = {
            BIG_HOT: source(40_000, "hot"),
            BIG_COLD: source(40_000, "cold"),
            SMALL: source(2_000, "small"),
        }
        cls.contents, cls.stats = run(
            cls.files,
            [SMALL, BIG_COLD, BIG_HOT],
            f"     15 {BIG_HOT}\n      2 {SMALL}\n",
        )

    def test_hotspot_is_windowed_not_skipped(self):
        self.assertIn(f"=== {BIG_HOT} (head and tail of ", self.contents)
        self.assertNotIn(f"[SKIPPED: {BIG_HOT}", self.contents)
        self.assertIn("// hot line 00000 ", self.contents)
        last = self.files[BIG_HOT].splitlines()[-1]
        self.assertIn(last, self.contents)
        self.assertIn(f"[... {BIG_HOT}: lines ", self.contents)

    def test_window_keeps_whole_lines_within_the_cap(self):
        block = self.contents.split(f"=== {BIG_HOT} ")[1].split("\n=== ")[0]
        self.assertLess(len(block), 33_000)
        for line in block.splitlines()[1:]:
            if line.startswith("// hot"):
                self.assertRegex(line, r"^// hot line \d{5} x{60}$")

    def test_non_hotspot_over_the_limit_is_still_skipped(self):
        self.assertIn(f"[SKIPPED: {BIG_COLD} (", self.contents)
        self.assertNotIn("// cold line", self.contents)

    def test_hotspots_come_first_busiest_first(self):
        self.assertLess(
            self.contents.index(f"=== {BIG_HOT}"), self.contents.index(f"=== {SMALL}")
        )

    def test_stats_count_windowed_files(self):
        self.assertTrue(self.stats.startswith("diff: stats\n"))
        self.assertRegex(self.stats, r"file contents: \d+ bytes shown of 3 candidate files")
        self.assertIn("1 hotspot file(s) windowed", self.stats)


class BoostLimits(unittest.TestCase):
    # The 2026-10-01 replay: unbounded hotspot-first let spec files,
    # package.json and a 64KB page crowd every +server.ts route out of the
    # budget, the blind spot the workflow's server-first order exists for.
    def test_only_app_source_hotspots_jump_the_queue(self):
        files = {
            "src/routes/api/x/+server.ts": source(1_000, "server"),
            "tests/busy.spec.ts": source(1_000, "spec"),
            "package.json": source(1_000, "pkg"),
            "src/lib/busy.test.ts": source(1_000, "unit"),
        }
        contents, _ = run(
            files,
            list(files),
            "     39 package.json\n     9 tests/busy.spec.ts\n     8 src/lib/busy.test.ts\n",
        )
        order = [line for line in contents.splitlines() if line.startswith("=== ")]
        self.assertEqual(order[0], "=== src/routes/api/x/+server.ts ===")

    def test_hotspot_boost_stops_at_half_the_budget(self):
        hot = [f"src/routes/h{i}/+page.svelte" for i in range(4)]
        files = {p: source(25_000, f"h{i}") for i, p in enumerate(hot)}
        files["src/routes/api/x/+server.ts"] = source(1_000, "server")
        candidates = ["src/routes/api/x/+server.ts"] + hot
        hotspots = "".join(f"     {9 - i} {p}\n" for i, p in enumerate(hot))
        contents, _ = run(files, candidates, hotspots)
        order = [line for line in contents.splitlines() if line.startswith("=== ")]
        # Two 25KB hotspots fit the 60KB boost; the rest keep their place
        # behind the server route instead of being dropped from the order.
        self.assertEqual(
            order[:3],
            [f"=== {hot[0]} ===", f"=== {hot[1]} ===", "=== src/routes/api/x/+server.ts ==="],
        )

    def test_oversized_non_app_hotspot_is_skipped_not_windowed(self):
        files = {"tests/huge.spec.ts": source(40_000, "spec")}
        contents, _ = run(files, list(files), "     9 tests/huge.spec.ts\n")
        self.assertIn("[SKIPPED: tests/huge.spec.ts (", contents)


class Budget(unittest.TestCase):
    def test_marks_files_past_the_total_budget(self):
        files = {f"src/lib/f{i}.ts": source(30_000, f"f{i}") for i in range(5)}
        contents, _ = run(files, sorted(files))
        self.assertIn("[SKIPPED: src/lib/f4.ts (", contents)
        self.assertIn("context budget exhausted)]", contents)
        self.assertIn("=== src/lib/f0.ts ===", contents)

    def test_missing_candidates_are_ignored(self):
        contents, stats = run({SMALL: "x\n"}, ["src/lib/gone.ts", SMALL])
        self.assertIn(f"=== {SMALL} ===\nx\n", contents)
        self.assertNotIn("gone.ts", contents)


if __name__ == "__main__":
    unittest.main()
