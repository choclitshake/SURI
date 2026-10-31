import random
import unittest

from backend.problem_sampling import sample_mixed
from backend.routes import diagnostic_routes
from backend.routes.quiz_routes import step_timer_ms


def _probes(standard=16, challenge=8):
    return (
        [{"difficulty": "standard"} if i % 2 else {} for i in range(standard)]
        + [{"difficulty": "challenge"} for _ in range(challenge)]
    )


class ProbeOrderTests(unittest.TestCase):
    def test_first_four_are_three_standard_one_challenge(self):
        probes = _probes()
        for n in range(30):
            order = diagnostic_routes._probe_order(f"s{n}", "FD", probes)
            kinds = [probes[i].get("difficulty", "standard") for i in order[:4]]
            self.assertEqual(kinds.count("challenge"), 1)
            self.assertEqual(kinds.count("standard"), 3)

    def test_challenge_position_varies(self):
        probes = _probes()
        positions = {
            next(p for p, i in enumerate(diagnostic_routes._probe_order(f"s{n}", "FD", probes))
                 if probes[i].get("difficulty") == "challenge")
            for n in range(40)
        }
        self.assertGreater(len(positions), 1)

    def test_deterministic_and_permutation(self):
        probes = _probes()
        a = diagnostic_routes._probe_order("sess", "LE", probes)
        self.assertEqual(a, diagnostic_routes._probe_order("sess", "LE", probes))
        self.assertEqual(sorted(a), list(range(len(probes))))

    def test_falls_back_without_challenge_items(self):
        probes = _probes(challenge=0)
        order = diagnostic_routes._probe_order("sess", "FD", probes)
        self.assertEqual(sorted(order), list(range(16)))

    def test_existing_indices_untouched_by_appended_items(self):
        probes = _probes()
        order = diagnostic_routes._probe_order("sess", "FD", probes)
        self.assertTrue(all(0 <= i < len(probes) for i in order))


class SampleMixedTests(unittest.TestCase):
    def rows(self, standard, challenge):
        return (
            [{"id": f"s{i}", "difficulty": "standard"} for i in range(standard)]
            + [{"id": f"c{i}", "difficulty": "challenge"} for i in range(challenge)]
        )

    def test_normal_split(self):
        out = sample_mixed(self.rows(10, 5), rng=random.Random(1))
        self.assertEqual(len(out), 5)
        self.assertEqual(sum(r["difficulty"] == "challenge" for r in out), 2)
        self.assertEqual(len({r["id"] for r in out}), 5)

    def test_too_few_challenge(self):
        out = sample_mixed(self.rows(10, 1), rng=random.Random(1))
        self.assertEqual(len(out), 5)
        self.assertEqual(sum(r["difficulty"] == "challenge" for r in out), 1)

    def test_no_challenge(self):
        out = sample_mixed(self.rows(10, 0), rng=random.Random(1))
        self.assertEqual(len(out), 5)

    def test_too_few_standard_tops_up_from_challenge(self):
        out = sample_mixed(self.rows(1, 8), rng=random.Random(1))
        self.assertEqual(len(out), 5)
        self.assertEqual(len({r["id"] for r in out}), 5)

    def test_missing_difficulty_is_standard(self):
        rows = [{"id": str(i)} for i in range(10)]
        self.assertEqual(len(sample_mixed(rows)), 5)


class StepTimerTests(unittest.TestCase):
    def test_standard(self):
        self.assertEqual(step_timer_ms("algebra", "standard"), 60_000)
        self.assertEqual(step_timer_ms("variable_identification"), 60_000)

    def test_challenge(self):
        self.assertEqual(step_timer_ms("variable_identification", "challenge"), 90_000)
        self.assertEqual(step_timer_ms("algebra", "challenge"), 75_000)

    def test_unknown_type_defaults(self):
        self.assertEqual(step_timer_ms("other", "challenge"), 60_000)


if __name__ == "__main__":
    unittest.main()
