"""Core Sudoku generation, solving, and validation logic."""

from __future__ import annotations

import copy
import random
from typing import Optional

SIZE = 9
BOX_SIZE = 3
EMPTY = 0

# Number of clues retained for each difficulty. More clues means an easier puzzle.
DIFFICULTY_CLUES = {
    "easy": 45,
    "medium": 36,
    "hard": 30,
}


def deep_copy(board: list[list[int]]) -> list[list[int]]:
    return copy.deepcopy(board)


def create_empty_board() -> list[list[int]]:
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def is_safe(board: list[list[int]], row: int, col: int, num: int) -> bool:
    """Return whether num can be placed at board[row][col]."""
    for x in range(SIZE):
        if board[row][x] == num or board[x][col] == num:
            return False

    start_row = row - row % BOX_SIZE
    start_col = col - col % BOX_SIZE
    for i in range(BOX_SIZE):
        for j in range(BOX_SIZE):
            if board[start_row + i][start_col + j] == num:
                return False
    return True


def find_empty(board: list[list[int]]) -> Optional[tuple[int, int]]:
    """Return the next empty cell, or None when the board is complete."""
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] == EMPTY:
                return row, col
    return None


def fill_board(board: list[list[int]]) -> bool:
    """Fill a board with one randomized valid Sudoku solution."""
    empty = find_empty(board)
    if empty is None:
        return True

    row, col = empty
    candidates = list(range(1, SIZE + 1))
    random.shuffle(candidates)

    for candidate in candidates:
        if is_safe(board, row, col, candidate):
            board[row][col] = candidate
            if fill_board(board):
                return True
            board[row][col] = EMPTY

    return False


def count_solutions(board: list[list[int]], limit: int = 2) -> int:
    """Count solutions, stopping once ``limit`` solutions are found.

    A limit of two is sufficient to distinguish a unique puzzle from one
    with multiple solutions.
    """
    count = 0

    def solve() -> None:
        nonlocal count
        if count >= limit:
            return

        empty = find_empty(board)
        if empty is None:
            count += 1
            return

        row, col = empty
        for candidate in range(1, SIZE + 1):
            if is_safe(board, row, col, candidate):
                board[row][col] = candidate
                solve()
                board[row][col] = EMPTY
                if count >= limit:
                    return

    solve()
    return count


def has_unique_solution(board: list[list[int]]) -> bool:
    """Return True only when the puzzle has exactly one solution."""
    return count_solutions(deep_copy(board), limit=2) == 1


def remove_cells(board: list[list[int]], clues: int) -> list[list[int]]:
    """Remove cells while retaining exactly one solution."""
    if not 0 <= clues <= SIZE * SIZE:
        raise ValueError("clues must be between 0 and 81")

    puzzle = deep_copy(board)
    cells = [(row, col) for row in range(SIZE) for col in range(SIZE)]
    random.shuffle(cells)
    current_clues = SIZE * SIZE

    for row, col in cells:
        if current_clues <= clues:
            break

        original = puzzle[row][col]
        puzzle[row][col] = EMPTY

        if has_unique_solution(puzzle):
            current_clues -= 1
        else:
            puzzle[row][col] = original

    return puzzle


def normalize_difficulty(difficulty: str) -> str:
    """Validate and normalize a difficulty name."""
    normalized = str(difficulty or "medium").strip().lower()
    if normalized not in DIFFICULTY_CLUES:
        raise ValueError("difficulty must be easy, medium, or hard")
    return normalized


def generate_puzzle(clues: Optional[int] = None, difficulty: str = "medium") -> tuple[list[list[int]], list[list[int]]]:
    """Generate a valid puzzle and its solution with exactly one solution."""
    difficulty = normalize_difficulty(difficulty)
    if clues is None:
        clues = DIFFICULTY_CLUES[difficulty]

    board = create_empty_board()
    if not fill_board(board):
        raise RuntimeError("Unable to generate a complete Sudoku board")

    solution = deep_copy(board)
    puzzle = remove_cells(solution, clues)

    # Defensive final validation: never return a non-unique puzzle.
    if not has_unique_solution(puzzle):
        raise RuntimeError("Generated Sudoku puzzle does not have a unique solution")

    return puzzle, solution
