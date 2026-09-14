# Flask Sudoku Game

A refactored Flask Sudoku game that preserves the existing game structure while adding the required project features and several optional enhancements.

## Required features

- Easy, Medium, and Hard difficulty levels.
- Difficulty changes the number of prefilled clues.
- Every generated puzzle has exactly one unique solution.
- Immediate feedback for invalid row, column, or 3×3-box entries.
- Check Puzzle highlights incorrect entries without marking empty cells.
- Hint fills one correct empty cell and locks it.
- Completion message when the puzzle is solved.
- Timer with pause/resume support.
- Top 10 fastest-times leaderboard using browser `localStorage`.
- Leaderboard entries contain player name, time, and difficulty and persist between sessions.
- Light/Dark mode persisted in `localStorage`.
- Responsive desktop/mobile layout.
- Alternating 3×3 box styling.

## Optional enhancements implemented

- **Number Tracker:** buttons for 1–9 show how many copies of each number are currently on the board. Selecting a number highlights every occurrence; a number is marked complete when all nine copies have been used.
- **Note Mode:** toggle Note Mode and enter numbers into empty cells to add/remove small candidate notes without changing the board value.
- **Visual Solver:** a backtracking solver demonstration animates candidate attempts and backtracking. It restores the player's board after the demonstration so the animation does not give a game shortcut.

## Layout

- Difficulty and New Game controls are on the left of the Sudoku board.
- Check Puzzle, Hint, and Note Mode are on the right, with Hint directly below Check Puzzle.
- The timer is displayed as plain text directly below the Sudoku board.
- The Top 10 leaderboard is displayed directly below the game rather than requiring a separate scores modal.

## Review fixes included

- Immediate conflict highlighting now marks every duplicate in the affected row, column, or 3×3 box, including prefilled clues, and clears when the conflict is removed.
- 3×3 boxes use alternating box-level backgrounds with thick sub-grid boundaries.
- Selected-number highlighting uses readable foreground/background contrast in both light and dark modes.
- Hint usage is counted per game, reset on New Game, saved with each leaderboard entry, and displayed in a dedicated Hints column. Existing leaderboard entries default to zero hints.

## Run locally

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open the local Flask URL shown in the terminal.

## Run tests

```bash
pytest -q
```

## Project structure

```text
app.py
sudoku_logic.py
templates/
    index.html
static/
    main.js
    styles.css
tests/
    test_app.py
    test_sudoku_logic.py
instruction.md
requirements.txt
README.md
```

## Difficulty

Difficulty is controlled by the number of prefilled clues:

- Easy: 45 clues
- Medium: 36 clues
- Hard: 30 clues

The generator removes a cell only when the resulting puzzle still has exactly one solution. Solution counting stops at two solutions because that is sufficient to distinguish a unique puzzle from a puzzle with multiple solutions.
