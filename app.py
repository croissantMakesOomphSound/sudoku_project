"""Flask application for the Sudoku game."""

from __future__ import annotations

import json
import os
import time
from typing import Any

from flask import Flask, jsonify, render_template, request

import sudoku_logic

app = Flask(__name__)

# Keep the current puzzle in memory, as the legacy application did.
CURRENT: dict[str, Any] = {
    "puzzle": None,
    "solution": None,
    "difficulty": "medium",
    "started_at": None,
}


# Legacy score endpoints are retained for compatibility, although the browser
# leaderboard now uses localStorage as required by the project instructions.
SCORES_FILE = os.path.join(os.path.dirname(__file__), "scores.json")


def load_scores() -> list[dict[str, Any]]:
    """Load legacy server-side scores safely."""
    if os.path.exists(SCORES_FILE):
        try:
            with open(SCORES_FILE, "r", encoding="utf-8") as file:
                scores = json.load(file)
                return scores if isinstance(scores, list) else []
        except (json.JSONDecodeError, OSError):
            return []
    return []


def save_scores(scores: list[dict[str, Any]]) -> None:
    """Save legacy server-side scores."""
    with open(SCORES_FILE, "w", encoding="utf-8") as file:
        json.dump(scores, file, indent=2, ensure_ascii=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/new")
def new_game():
    """Generate a new puzzle for the requested difficulty."""
    difficulty = request.args.get("difficulty", "medium")
    try:
        difficulty = sudoku_logic.normalize_difficulty(difficulty)
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty=difficulty)
    except (ValueError, RuntimeError) as exc:
        return jsonify({"error": str(exc)}), 400

    CURRENT.update(
        {
            "puzzle": puzzle,
            "solution": solution,
            "difficulty": difficulty,
            "started_at": time.monotonic(),
        }
    )
    return jsonify({"puzzle": puzzle, "difficulty": difficulty})


@app.route("/check", methods=["POST"])
def check_solution():
    """Compare a submitted board with the current solution."""
    data = request.get_json(silent=True) or {}
    board = data.get("board")
    solution = CURRENT.get("solution")

    if solution is None:
        return jsonify({"error": "No game in progress"}), 400
    if not isinstance(board, list) or len(board) != sudoku_logic.SIZE:
        return jsonify({"error": "Invalid board"}), 400

    incorrect: list[list[int]] = []
    complete = True

    for row in range(sudoku_logic.SIZE):
        if not isinstance(board[row], list) or len(board[row]) != sudoku_logic.SIZE:
            return jsonify({"error": "Invalid board"}), 400
        for col in range(sudoku_logic.SIZE):
            value = board[row][col]
            if value in (None, "", 0):
                complete = False
                continue
            try:
                value = int(value)
            except (TypeError, ValueError):
                incorrect.append([row, col])
                complete = False
                continue
            if value != solution[row][col]:
                incorrect.append([row, col])
                complete = False

    solved = complete and not incorrect
    server_elapsed = None
    if solved and CURRENT.get("started_at") is not None:
        server_elapsed = max(0, round(time.monotonic() - CURRENT["started_at"]))

    return jsonify(
        {
            "incorrect": incorrect,
            "solved": solved,
            "difficulty": CURRENT.get("difficulty", "medium"),
            "elapsed_seconds": server_elapsed,
        }
    )


@app.route("/hint", methods=["POST"])
def hint():
    """Return one correct value for an empty cell."""
    solution = CURRENT.get("solution")
    if solution is None:
        return jsonify({"error": "No game in progress"}), 400

    data = request.get_json(silent=True) or {}
    board = data.get("board")
    if not isinstance(board, list) or len(board) != sudoku_logic.SIZE:
        return jsonify({"error": "Invalid board"}), 400

    empty_cells = []
    for row in range(sudoku_logic.SIZE):
        if not isinstance(board[row], list) or len(board[row]) != sudoku_logic.SIZE:
            return jsonify({"error": "Invalid board"}), 400
        for col in range(sudoku_logic.SIZE):
            if board[row][col] in (None, "", 0):
                empty_cells.append((row, col))

    if not empty_cells:
        return jsonify({"error": "No empty cells remain"}), 400

    row, col = empty_cells[0]
    return jsonify({"row": row, "col": col, "value": solution[row][col]})


# Legacy endpoints retained so existing functionality is not unnecessarily removed.
@app.route("/save-score", methods=["POST"])
def save_score():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    score = data.get("score")

    if not name or score is None:
        return jsonify({"error": "Name and score required"}), 400

    try:
        score = int(score)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid score format"}), 400
    if score < 0:
        return jsonify({"error": "Score must be non-negative"}), 400

    scores = load_scores()
    scores.append({"name": name[:50], "score": score})
    scores.sort(key=lambda entry: entry["score"], reverse=True)
    scores = scores[:10]
    save_scores(scores)
    return jsonify({"success": True, "scores": scores})


@app.route("/scores")
def get_scores():
    return jsonify({"scores": load_scores()})




if __name__ == "__main__":
    app.run(debug=True)
