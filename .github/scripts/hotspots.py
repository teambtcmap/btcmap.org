# The period's most-changed files, busiest first, as the workflow's
# `uniq -c | sort -rn` writes them to {TMP}/hotspots.txt. Both budgets
# (diff and file contents) spend on these first. Missing file → no ranking.


def hotspot_rank(tmp: str) -> dict[str, int]:
    try:
        with open(f"{tmp}/hotspots.txt", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return {}
    rank: dict[str, int] = {}
    for line in lines:
        parts = line.split(maxsplit=1)
        if len(parts) == 2 and parts[0].isdigit():
            rank.setdefault(parts[1], len(rank))
    return rank
