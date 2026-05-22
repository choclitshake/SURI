import requests
import random
import string
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_flow():
    print("=== Starting SURI Bug Fixes E2E Verification ===")
    
    # 1. Create a session with requests
    s = requests.Session()
    
    # Generate unique student name
    student_name = "test_student_" + "".join(random.choices(string.ascii_lowercase, k=6))
    print(f"Registering student: {student_name}")
    
    reg_res = s.post(f"{BASE_URL}/api/auth/register", json={
        "name": student_name,
        "grade_level": 9,
        "password": "password123"
    })
    
    if reg_res.status_code != 201:
        print(f"FAIL: Registration failed with status {reg_res.status_code}")
        print(reg_res.text)
        sys.exit(1)
        
    reg_data = reg_res.json()
    student_id = reg_data["student_id"]
    print(f"SUCCESS: Registered student {student_id}")
    
    # 2. Create session for "QE"
    print("Creating learning session for 'QE'...")
    sess_res = s.post(f"{BASE_URL}/api/sessions", json={
        "topic_entry_node": "QE"
    })
    if sess_res.status_code != 200:
        print(f"FAIL: Session creation failed: {sess_res.text}")
        sys.exit(1)
        
    sess_data = sess_res.json()
    session_id = sess_data["id"]
    print(f"SUCCESS: Created session {session_id}")
    
    # 3. Test BUG 1 & BUG 2: Diagnostic submission and gap_node selection
    # Topic chain for QE: ["QE", "FP", "SP", "LE", "OI", "FD"] (from top to bottom)
    # We want to mark:
    # FD: mastered (correct)
    # OI: mastered (correct)
    # LE: unresolved (incorrect)
    # SP: unresolved (incorrect)
    # FP: unresolved (incorrect)
    # QE: mastered (correct)
    # Since we search from bottom to top (reversed chain), the unresolved nodes are LE, SP, FP.
    # The deepest unresolved node is LE (index 3 in chain).
    # Let's verify if gap_node returned is "LE" and we get node_statuses in the response.
    
    print("Submitting diagnostic answers...")
    diag_res = s.post(f"{BASE_URL}/api/diagnostic/{session_id}/submit", json={
        "answers": [
            {"node_id": "FD", "correct": True},
            {"node_id": "OI", "correct": True},
            {"node_id": "LE", "correct": False},
            {"node_id": "SP", "correct": False},
            {"node_id": "FP", "correct": False},
            {"node_id": "QE", "correct": True}
        ]
    })
    
    if diag_res.status_code != 200:
        print(f"FAIL: Diagnostic submission failed: {diag_res.text}")
        sys.exit(1)
        
    diag_data = diag_res.json()
    print("Diagnostic response keys:", list(diag_data.keys()))
    
    # Verify Bug 1: node_statuses exists in return
    if "node_statuses" not in diag_data:
        print("FAIL: BUG 1 - node_statuses not found in diagnostic submit response")
        sys.exit(1)
    
    node_statuses = diag_data["node_statuses"]
    print("Received node statuses:")
    for ns in node_statuses:
        print(f"  Node {ns['node_id']}: status={ns['status']}, source={ns['source']}")
        
    # Verify Bug 2: gap_node is deepest unresolved (LE)
    expected_gap_node = "LE"
    actual_gap_node = diag_data.get("gap_node")
    if actual_gap_node != expected_gap_node:
        print(f"FAIL: BUG 2 - Expected gap_node '{expected_gap_node}', but got '{actual_gap_node}'")
        sys.exit(1)
    print(f"SUCCESS: BUG 1 & BUG 2 verified! gap_node is indeed '{actual_gap_node}'")
    
    # 4. Verify BUG 4 (float type of completion_percentage) and BUG 3 (active sessions on dashboard)
    print("Fetching student progress for dashboard...")
    prog_res = s.get(f"{BASE_URL}/api/students/{student_id}/progress")
    if prog_res.status_code != 200:
        print(f"FAIL: Fetch progress failed: {prog_res.text}")
        sys.exit(1)
        
    prog_data = prog_res.json()
    active_sessions = prog_data.get("active_sessions", [])
    completed_sessions = prog_data.get("completed_sessions", [])
    
    if len(active_sessions) != 1:
        print(f"FAIL: BUG 3 - Expected 1 active session, got {len(active_sessions)}")
        sys.exit(1)
        
    active_sess = active_sessions[0]
    pct = active_sess.get("completion_percentage")
    print(f"Active session completion percentage: {pct} (type: {type(pct)})")
    
    # Expected: 3 mastered (QE, OI, FD) out of 6 nodes = 50.0%
    if not isinstance(pct, float):
        print(f"FAIL: BUG 4 - completion_percentage is not a float: {pct} ({type(pct)})")
        sys.exit(1)
        
    if pct != 50.0:
        print(f"FAIL: completion_percentage expected 50.0, got {pct}")
        sys.exit(1)
        
    print("SUCCESS: BUG 4 & part of BUG 3 verified! percentage is float (50.0) and active session is active.")
    
    # 5. Let's do practice on LE and verify we progress to SP (next unresolved node upward)
    def complete_practice_node(node_id):
        print(f"Starting practice on '{node_id}'...")
        start_res = s.post(f"{BASE_URL}/api/practice/start", json={
            "session_id": session_id,
            "node_id": node_id
        })
        if start_res.status_code != 200:
            print(f"FAIL: Practice start failed for '{node_id}': {start_res.text}")
            sys.exit(1)
            
        problems = start_res.json()["problems"]
        print(f"Retrieved {len(problems)} practice problems.")
        
        for problem in problems:
            prob_id = problem["id"]
            steps = problem["steps"]
            student_steps = []
            for step in steps:
                student_steps.append({
                    "step_index": step["step_index"],
                    "submitted_value": step["correct_value"]
                })
            
            sub_res = s.post(f"{BASE_URL}/api/practice/submit-step", json={
                "session_id": session_id,
                "node_id": node_id,
                "problem_id": prob_id,
                "student_steps": student_steps
            })
            if sub_res.status_code != 200:
                print(f"FAIL: Submit step failed: {sub_res.text}")
                sys.exit(1)
        
        # Decide progression
        print(f"Calling progression/decide for '{node_id}'...")
        decide_res = s.post(f"{BASE_URL}/api/progression/decide", json={
            "session_id": session_id,
            "node_id": node_id
        })
        if decide_res.status_code != 200:
            print(f"FAIL: progression/decide failed: {decide_res.text}")
            sys.exit(1)
            
        return decide_res.json()
        
    # Practice LE
    decide_data = complete_practice_node("LE")
    print("LE Progression Decision:", decide_data)
    if decide_data["decision"] != "advance" or decide_data["next_node_id"] != "SP":
        print(f"FAIL: Expected advancement to 'SP', but got {decide_data}")
        sys.exit(1)
    print("SUCCESS: Advanced to 'SP' after passing practice on 'LE'.")
    
    # 6. Practice SP
    decide_data = complete_practice_node("SP")
    print("SP Progression Decision:", decide_data)
    if decide_data["decision"] != "advance" or decide_data["next_node_id"] != "FP":
        print(f"FAIL: Expected advancement to 'FP', but got {decide_data}")
        sys.exit(1)
    print("SUCCESS: Advanced to 'FP' after passing practice on 'SP'.")
    
    # 7. Test BUG 5: Practice FP. Since QE was mastered in diagnostic, passing FP should mark FP as mastered,
    # and mark prerequisites SP, LE, OI, FD as mastered (implied, which they already are).
    # Since QE, FP, SP, LE, OI, FD are all mastered now, all 6 nodes in the chain are mastered.
    # The progression should auto-complete the session immediately!
    decide_data = complete_practice_node("FP")
    print("FP Progression Decision:", decide_data)
    if not decide_data.get("topic_complete"):
        print(f"FAIL: BUG 5 - Topic did not complete automatically when all nodes are mastered. Decision: {decide_data}")
        sys.exit(1)
    print("SUCCESS: BUG 5 verified! Topic completed automatically via implied mastery check.")
    
    # 8. Fetch student progress and verify completed sessions (BUG 3)
    print("Checking student progress again...")
    prog_res = s.get(f"{BASE_URL}/api/students/{student_id}/progress")
    prog_data = prog_res.json()
    active_sessions = prog_data.get("active_sessions", [])
    completed_sessions = prog_data.get("completed_sessions", [])
    
    print(f"Active sessions: {len(active_sessions)}, Completed sessions: {len(completed_sessions)}")
    if len(active_sessions) != 0:
        print("FAIL: Expected 0 active sessions after topic completion")
        sys.exit(1)
        
    if len(completed_sessions) != 1:
        print("FAIL: BUG 3 - Expected 1 completed session, got 0")
        sys.exit(1)
        
    comp_sess = completed_sessions[0]
    completed_at = comp_sess.get("completed_at")
    print(f"Completed session: id={comp_sess['id']}, topic={comp_sess['topic_label']}, completed_at={completed_at}")
    if not completed_at:
        print("FAIL: BUG 3 - completed_at is empty or missing")
        sys.exit(1)
        
    print("SUCCESS: BUG 3 verified! Session moved to Completed Topics and contains completed_at.")
    
    # 9. Test "Review Again" action (BUG 3)
    print("Simulating 'Review Again' for completed topic 'QE'...")
    rev_res = s.post(f"{BASE_URL}/api/sessions", json={
        "topic_entry_node": "QE"
    })
    if rev_res.status_code != 200:
        print(f"FAIL: Review session creation failed: {rev_res.text}")
        sys.exit(1)
        
    rev_data = rev_res.json()
    new_session_id = rev_data["id"]
    print(f"SUCCESS: Created new session for review: {new_session_id}")
    
    if new_session_id == session_id:
        print("FAIL: Expected a new session ID for Review Again, but got the old one")
        sys.exit(1)
        
    # Check progress dashboard again
    prog_res = s.get(f"{BASE_URL}/api/students/{student_id}/progress")
    prog_data = prog_res.json()
    active_sessions = prog_data.get("active_sessions", [])
    completed_sessions = prog_data.get("completed_sessions", [])
    print(f"After Review Again -> Active: {len(active_sessions)}, Completed: {len(completed_sessions)}")
    
    if len(active_sessions) != 1:
        print("FAIL: Expected new active session after Review Again")
        sys.exit(1)
        
    if len(completed_sessions) != 1:
        print("FAIL: Expected completed session to remain in completed_sessions list")
        sys.exit(1)
        
    print("SUCCESS: BUG 3 'Review Again' flow fully verified!")
    print("ALL TESTS PASSED SUCCESSFULLY! All 5 bugs are verified fixed in the backend.")

if __name__ == "__main__":
    test_flow()
