"""Spell, checkpoint and retry regressions without network services or a database."""

import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from backend.models.schemas import PracticeBattleActionRequest, PracticeBattleActionResponse
from backend.practice_battle import new_battle_state, resolve_action
from backend.routes import practice_routes


STEPS = [{"step_index": i, "correct_value": "42"} for i in range(6)]


class SpellRulesTests(unittest.TestCase):
    def setUp(self):
        self.state = new_battle_state()

    def act(self, action, correct=None):
        return resolve_action(self.state, action, STEPS, correct)

    def test_flame_waits_for_correct_answer_and_only_rewards_once(self):
        self.act("flame")
        wrong = self.act("answer", False)
        self.assertTrue(wrong["flame_ready"])
        self.assertEqual(wrong["score"], 0)
        hit = self.act("answer", True)
        self.assertEqual((hit["bonus"], hit["score"]), (25, 35))
        self.assertEqual(self.state["step_position"], 1)
        normal = self.act("answer", True)
        self.assertEqual((normal["bonus"], normal["score"]), (0, 50))

    def test_ward_blocks_exactly_one_hit_and_does_not_advance_step(self):
        self.act("ward")
        self.act("answer", True)
        self.assertTrue(self.state["ward_ready"])
        blocked = self.act("answer", False)
        self.assertTrue(blocked["blocked"])
        self.assertFalse(blocked["correct"])
        self.assertEqual((blocked["hearts"], self.state["step_position"], self.state["streak"]), (3, 1, 0))
        self.assertEqual(self.act("answer", False)["hearts"], 2)

    def test_full_health_does_not_spend_bloom_and_heal_is_capped(self):
        with self.assertRaises(HTTPException):
            self.act("bloom")
        self.assertEqual(self.state["used"], [])
        self.act("answer", False)
        self.assertEqual(self.act("bloom")["hearts"], 3)
        with self.assertRaises(HTTPException):
            self.act("bloom")

    def test_charges_cannot_be_reused(self):
        for spell in ("flame", "ward"):
            self.act(spell)
            with self.assertRaises(HTTPException) as error:
                self.act(spell)
            self.assertEqual(error.exception.status_code, 409)

    def test_defeat_restores_checkpoint_but_does_not_refill_charges(self):
        self.act("flame")
        for _ in range(4):
            self.act("answer", True)
        for _ in range(3):
            last = self.act("answer", False)
        self.assertEqual(last["hearts"], 0)  # frontend plays defeat before restoring
        self.assertEqual((self.state["hearts"], self.state["step_position"]), (3, 3))
        self.assertIn("flame", self.state["used"])

    def test_early_defeat_resets_to_first_step(self):
        self.act("answer", True)
        for _ in range(3):
            self.act("answer", False)
        self.assertEqual(self.state["step_position"], 0)

    def test_new_enemy_refills_spells_and_keeps_score_and_streak(self):
        self.act("ward")
        for _ in STEPS:
            last = self.act("answer", True)
        self.assertEqual(self.state["problem_index"], 1)
        self.assertEqual(self.state["step_position"], 0)
        self.assertEqual(self.state["used"], [])
        self.assertFalse(self.state["ward_ready"])
        self.assertEqual(self.state["score"], last["score"])
        self.assertEqual(self.state["streak"], 6)


class BattleDatabase:
    def __init__(self):
        self.row = {
            "state_json": json.dumps(new_battle_state()),
            "problem_ids_json": json.dumps(["enemy", "enemy2"]),
            "last_request_id": None, "last_response_json": None,
        }
        self.writes = 0

    async def fetchrow(self, query, *args):
        if "FROM practice_battles" in query:
            assert "FOR UPDATE OF b" in query
            return dict(self.row) if args == ("battle", "student") else None
        if "FROM practice_problems" in query:
            return {"steps_json": json.dumps(STEPS)}
        raise AssertionError(query)

    async def execute(self, query, *args):
        assert "UPDATE practice_battles" in query
        self.row.update(state_json=args[0], last_request_id=args[1], last_response_json=args[2])
        self.writes += 1

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class BattleEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = BattleDatabase()
        for name, value in {"get_db": AsyncMock(return_value=self.db), "release_db": AsyncMock()}.items():
            patcher = patch.object(practice_routes, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def act(self, action, request_id="request", student="student", problem="enemy", **kwargs):
        response = await practice_routes.battle_action(PracticeBattleActionRequest(
            battle_id="battle", problem_id=problem, request_id=request_id,
            action=action, **kwargs,
        ), student={"id": student})
        return PracticeBattleActionResponse(**response)

    async def test_retried_cast_and_answer_replay_without_double_spending(self):
        first = await self.act("flame")
        self.assertEqual(first, await self.act("flame"))
        self.assertEqual(self.db.writes, 1)
        first = await self.act("answer", "answer", step_index=0, submitted_value="42")
        self.assertEqual(first, await self.act("answer", "answer", step_index=0, submitted_value="42"))
        self.assertEqual((first.bonus, first.score, self.db.writes), (25, 35, 2))
        self.assertEqual(json.loads(self.db.row["state_json"])["step_position"], 1)

    async def test_other_students_cannot_cast(self):
        with self.assertRaises(HTTPException) as error:
            await self.act("ward", student="someone-else")
        self.assertEqual(error.exception.status_code, 404)
        self.assertEqual(self.db.writes, 0)

    async def test_wrong_enemy_and_out_of_order_steps_are_rejected(self):
        with self.assertRaises(HTTPException):
            await self.act("flame", problem="enemy2")
        with self.assertRaises(HTTPException):
            await self.act("answer", step_index=2, submitted_value="42")
        self.assertEqual(self.db.writes, 0)

    async def test_server_grades_normalized_numeric_answers(self):
        result = await self.act("answer", step_index=0, submitted_value=" $42.0$ ")
        self.assertTrue(result.correct)
        self.assertEqual(result.score, 10)


if __name__ == "__main__":
    unittest.main()
