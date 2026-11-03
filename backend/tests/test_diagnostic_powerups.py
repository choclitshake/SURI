"""Diagnostic spells cannot change grading; retries cannot add extra assessment logs."""

import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from backend.diagnostic_battle import new_diagnostic_battle, resolve_diagnostic_hit, resolve_diagnostic_spell
from backend.models.schemas import DiagnosticAnswerRequest, DiagnosticSpellRequest
from backend.routes import diagnostic_routes


class DiagnosticBattleDatabase:
    def __init__(self):
        self.session = {"id": "session", "student_id": "student", "current_node": "FD",
                        "topic_entry_node": "FD", "completed": 0, "current_probe_index": 0}
        self.battle = {"id": "battle", "session_id": "session", "state_json": json.dumps(new_diagnostic_battle()),
                       "last_request_id": None, "last_response_json": None}
        self.logs = []
        self.writes = 0

    async def fetchrow(self, query, *args):
        if "FROM diagnostic_battles" in query:
            assert "FOR UPDATE OF b" in query
            if args != (self.battle["id"], "session", "student"):
                return None
            return {**self.battle, "session_completed": self.session["completed"],
                    "current_probe_index": self.session["current_probe_index"]}
        if "FROM sessions" in query:
            return dict(self.session) if args == ("session", "student") else None
        if "FROM diagnostic_logs" in query:
            return {"cnt": len(self.logs), "correct": sum(self.logs)}
        raise AssertionError(query)

    async def execute(self, query, *args):
        self.writes += 1
        if "CREATE TABLE" in query:
            return
        if "INSERT INTO diagnostic_battles" in query:
            self.battle.update(id=args[0], session_id=args[1], state_json=args[2], last_request_id=None, last_response_json=None)
        elif "UPDATE diagnostic_battles" in query:
            self.battle.update(state_json=args[0], last_request_id=args[1], last_response_json=args[2])
        elif "INSERT INTO diagnostic_logs" in query:
            self.logs.append(args[3])
        elif "UPDATE sessions" in query:
            self.session["current_probe_index"] = None
        else:
            raise AssertionError(query)

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class DiagnosticPowerupTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = DiagnosticBattleDatabase()
        for name, value in {
            "get_db": AsyncMock(return_value=self.db), "release_db": AsyncMock(),
            "PROBES": {"FD": [{"correct_option_index": 0}]},
            "get_chain": lambda node: ["FD"], "get_prerequisite_path": lambda *args: [],
        }.items():
            patcher = patch.object(diagnostic_routes, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    async def cast(self, spell, request_id=None, student="student"):
        return await diagnostic_routes.cast_diagnostic_spell("session", DiagnosticSpellRequest(
            battle_id="battle", request_id=request_id or spell, spell=spell,
        ), student={"id": student})

    async def answer(self, correct, request_id="answer", legacy=False):
        return await diagnostic_routes.submit_diagnostic_answer("session", DiagnosticAnswerRequest(
            node_id="FD", selected_option_index=0 if correct else 1,
            **({} if legacy else {"battle_id": "battle", "request_id": request_id}),
        ), student={"id": "student"})

    async def test_flame_bonus_never_skips_questions_or_inflates_correct_counts(self):
        await self.cast("flame")
        result = await self.answer(True)
        self.assertTrue(result["correct"])
        self.assertEqual((result["battle"]["bonus"], result["battle"]["score"]), (25, 35))
        self.assertEqual(result["battle"]["enemy_hearts"], 4)
        self.assertEqual(result["next_action"], "next_probe")
        self.assertEqual(self.db.logs, [1])

    async def test_blocked_wrong_answer_is_still_logged_incorrect(self):
        await self.cast("ward")
        result = await self.answer(False)
        self.assertFalse(result["correct"])
        self.assertTrue(result["battle"]["blocked"])
        self.assertEqual((result["battle"]["hearts"], result["battle"]["score"]), (5, 0))
        self.assertEqual(self.db.logs, [0])
        self.db.session["current_probe_index"] = 0
        next_result = await self.answer(False, "second")
        self.assertEqual(next_result["battle"]["hearts"], 4)

    async def test_cast_and_answer_retries_are_idempotent_even_after_probe_clears(self):
        first = await self.cast("flame")
        self.assertEqual(first, await self.cast("flame"))
        result = await self.answer(True)
        self.assertIsNone(self.db.session["current_probe_index"])
        self.assertEqual(result, await self.answer(True))
        self.assertEqual(self.db.logs, [1])
        self.assertEqual(json.loads(self.db.battle["state_json"])["score"], 35)

    async def test_full_health_does_not_spend_heal_and_healing_uses_five_heart_cap(self):
        with self.assertRaises(HTTPException):
            await self.cast("bloom")
        self.assertEqual(json.loads(self.db.battle["state_json"])["used"], [])
        await self.answer(False)
        self.db.session["current_probe_index"] = 0
        self.assertEqual((await self.cast("bloom"))["hearts"], 5)
        with self.assertRaises(HTTPException):
            await self.cast("bloom", "second-heal")

    async def test_assessment_completion_is_independent_of_remaining_enemy_hearts(self):
        for i in range(3):
            self.db.session["current_probe_index"] = 0
            result = await self.answer(True, f"answer-{i}")
        self.assertEqual(result["next_action"], "complete")
        self.assertTrue(result["node_passed"])
        self.assertEqual(result["questions_answered"], 3)
        self.assertEqual(result["battle"]["enemy_hearts"], 2)
        self.assertEqual(self.db.logs, [1, 1, 1])
        with self.assertRaises(HTTPException):
            await self.cast("flame")

    async def test_two_wrong_answers_stop_traversal_even_when_ward_blocks_damage(self):
        with patch.object(diagnostic_routes, "get_chain", return_value=["OI", "FD"]):
            await self.cast("ward")
            first = await self.answer(False, "wrong-1")
            self.assertTrue(first["battle"]["blocked"])
            self.assertEqual(first["next_action"], "next_probe")
            self.db.session["current_probe_index"] = 0
            result = await self.answer(False, "wrong-2")
        self.assertEqual(result["next_action"], "complete")
        self.assertFalse(result["node_passed"])
        self.assertEqual(result["wrong_count"], 2)
        self.assertEqual(result["identified_node_id"], "FD")
        self.assertIsNone(result["next_node_id"])
        self.assertEqual(result["battle"]["hearts"], 4)
        self.assertTrue(json.loads(self.db.battle["state_json"])["finished"])

    async def test_three_correct_answers_advance_to_next_node_with_powerups(self):
        with patch.object(diagnostic_routes, "get_chain", return_value=["OI", "FD"]):
            await self.cast("flame")
            for i in range(3):
                self.db.session["current_probe_index"] = 0
                result = await self.answer(True, f"right-{i}")
        self.assertEqual(result["next_action"], "next_probe")
        self.assertTrue(result["node_passed"])
        self.assertEqual(result["correct_count"], 3)
        self.assertEqual(result["next_node_id"], "OI")
        self.assertFalse(json.loads(self.db.battle["state_json"])["finished"])

    async def test_legacy_answer_payload_still_uses_original_grading(self):
        result = await self.answer(False, legacy=True)
        self.assertFalse(result["correct"])
        self.assertNotIn("battle", result)
        self.assertEqual(self.db.logs, [0])

    async def test_other_students_cannot_cast_or_start_battles(self):
        with self.assertRaises(HTTPException) as error:
            await self.cast("ward", student="other")
        self.assertEqual(error.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            await diagnostic_routes.start_diagnostic_battle("session", student={"id": "other"})
        self.assertEqual(self.db.writes, 0)

    async def test_new_battle_resets_spell_state_without_deleting_assessment_logs(self):
        await self.answer(False)
        result = await diagnostic_routes.start_diagnostic_battle("session", student={"id": "student"})
        self.assertEqual(result["battle"]["hearts"], 5)
        self.assertEqual(result["battle"]["used"], [])
        self.assertEqual(self.db.logs, [0])


class DiagnosticEnemyCycleTests(unittest.TestCase):
    def test_new_enemy_refills_charges_and_preserves_hero_health_and_score(self):
        state = new_diagnostic_battle()
        resolve_diagnostic_hit(state, False, "next_probe")
        resolve_diagnostic_spell(state, "flame")
        resolve_diagnostic_spell(state, "ward")
        for _ in range(5):
            result = resolve_diagnostic_hit(state, True, "next_probe")
        self.assertEqual(result["enemy_hearts"], 0)
        self.assertEqual((state["enemy_hearts"], state["hearts"]), (5, 4))
        self.assertEqual(state["used"], [])
        self.assertFalse(state["ward_ready"])
        self.assertEqual(state["score"], result["score"])

    def test_defeat_does_not_restore_health_or_refill_spells(self):
        state = new_diagnostic_battle()
        resolve_diagnostic_spell(state, "flame")
        for _ in range(5):
            result = resolve_diagnostic_hit(state, False, "next_probe")
        self.assertEqual(result["hearts"], 0)
        self.assertTrue(state["finished"])
        self.assertIn("flame", state["used"])


if __name__ == "__main__":
    unittest.main()
