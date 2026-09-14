import sudoku_logic
from app import app, CURRENT


def reset_current():
    CURRENT.update({"puzzle": None, "solution": None, "difficulty": "medium", "started_at": None})


def test_index_loads():
    client = app.test_client()
    response = client.get("/")
    assert response.status_code == 200
    assert b"Sudoku Game" in response.data


def test_new_game_accepts_each_difficulty():
    client = app.test_client()
    for difficulty in ("easy", "medium", "hard"):
        response = client.get(f"/new?difficulty={difficulty}")
        assert response.status_code == 200
        data = response.get_json()
        assert data["difficulty"] == difficulty
        assert sum(cell != 0 for row in data["puzzle"] for cell in row) == sudoku_logic.DIFFICULTY_CLUES[difficulty]
        assert sudoku_logic.has_unique_solution(data["puzzle"])
    reset_current()


def test_new_game_rejects_invalid_difficulty():
    client = app.test_client()
    response = client.get("/new?difficulty=extreme")
    assert response.status_code == 400


def test_check_does_not_mark_empty_cells_incorrect():
    client = app.test_client()
    client.get("/new?difficulty=easy")
    board = [row[:] for row in CURRENT["puzzle"]]
    response = client.post("/check", json={"board": board})
    data = response.get_json()
    assert data["incorrect"] == []
    assert data["solved"] is False
    reset_current()


def test_check_accepts_correct_solution():
    client = app.test_client()
    client.get("/new?difficulty=easy")
    response = client.post("/check", json={"board": CURRENT["solution"]})
    data = response.get_json()
    assert response.status_code == 200
    assert data["solved"] is True
    assert data["incorrect"] == []
    reset_current()


def test_hint_returns_a_correct_empty_cell():
    client = app.test_client()
    client.get("/new?difficulty=easy")
    board = [row[:] for row in CURRENT["puzzle"]]
    response = client.post("/hint", json={"board": board})
    data = response.get_json()
    assert response.status_code == 200
    row, col = data["row"], data["col"]
    assert board[row][col] == 0
    assert data["value"] == CURRENT["solution"][row][col]
    reset_current()
