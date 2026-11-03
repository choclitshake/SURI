"""Diagnostic battle rewards are independent of assessment correctness and logs."""

from backend.practice_battle import cast_spell, resolve_spell_hit

DIAGNOSTIC_BATTLE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS diagnostic_battles (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    last_request_id TEXT,
    last_response_json TEXT
)
"""


def new_diagnostic_battle():
    return {
        "hearts": 5, "enemy_hearts": 5, "used": [],
        "flame_ready": False, "ward_ready": False,
        "score": 0, "streak": 0, "finished": False,
    }


def battle_snapshot(state, correct=None, blocked=False, bonus=0):
    return {
        **{key: list(state[key]) if key == "used" else state[key]
           for key in ("hearts", "enemy_hearts", "used", "flame_ready", "ward_ready", "score")},
        "correct": correct, "blocked": blocked, "bonus": bonus,
    }


def resolve_diagnostic_spell(state, spell):
    cast_spell(state, spell, 5)
    return battle_snapshot(state)


def resolve_diagnostic_hit(state, correct, next_action):
    blocked, bonus = resolve_spell_hit(state, correct)
    if correct:
        state["enemy_hearts"] = max(0, state["enemy_hearts"] - 1)
    result = battle_snapshot(state, correct, blocked, bonus)
    state["finished"] = state["hearts"] == 0 or next_action == "complete"
    if state["enemy_hearts"] == 0 and not state["finished"]:
        state.update(enemy_hearts=5, used=[], flame_ready=False, ward_ready=False)
    return result
