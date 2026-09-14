import sudoku_logic


def test_empty_board_is_safe_for_valid_candidate():
    board = sudoku_logic.create_empty_board()
    assert sudoku_logic.is_safe(board, 0, 0, 1)


def test_fill_board_creates_valid_solution():
    board = sudoku_logic.create_empty_board()
    assert sudoku_logic.fill_board(board)
    assert all(sorted(row) == list(range(1, 10)) for row in board)
    for col in range(9):
        assert sorted(board[row][col] for row in range(9)) == list(range(1, 10))
    assert sudoku_logic.count_solutions(board, limit=2) == 1


def test_generated_puzzles_have_unique_solution_and_requested_clues():
    for difficulty, expected_clues in sudoku_logic.DIFFICULTY_CLUES.items():
        puzzle, solution = sudoku_logic.generate_puzzle(difficulty=difficulty)
        assert sum(cell != 0 for row in puzzle for cell in row) == expected_clues
        assert sudoku_logic.has_unique_solution(puzzle)
        assert sudoku_logic.count_solutions(solution, limit=2) == 1


def test_difficulties_have_meaningfully_different_clue_counts():
    clues = sudoku_logic.DIFFICULTY_CLUES
    assert clues["easy"] > clues["medium"] > clues["hard"]


def test_remove_cells_does_not_modify_original_solution():
    board = sudoku_logic.create_empty_board()
    sudoku_logic.fill_board(board)
    original = sudoku_logic.deep_copy(board)
    puzzle = sudoku_logic.remove_cells(board, 45)
    assert board == original
    assert sum(cell != 0 for row in puzzle for cell in row) == 45


def test_invalid_difficulty_is_rejected():
    try:
        sudoku_logic.normalize_difficulty("extreme")
    except ValueError:
        pass
    else:
        raise AssertionError("Expected ValueError for invalid difficulty")
