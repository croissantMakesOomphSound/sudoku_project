# Agent Instructions — Sudoku Refactoring Project

## 1. Project Overview

This project is a legacy **Python Flask Sudoku game** that must be refactored and extended into a modern, maintainable web application.

The goal is to preserve the existing Sudoku functionality while improving the code structure and adding the required game features.

The application must provide:

* A functional 9×9 Sudoku board.
* Easy, Medium, and Hard difficulty levels.
* Guaranteed unique puzzle solutions.
* Immediate feedback for invalid moves.
* A Check Puzzle feature.
* A Hint feature.
* A completion message.
* A game timer.
* A persistent Top 10 leaderboard.
* Light/Dark mode.
* Responsive desktop and mobile UI.

---

## 2. Refactoring Goals

Before making changes, inspect and understand the existing legacy code.

Refactor it toward:

* Clear separation of concerns.
* Small, reusable functions.
* Minimal code duplication.
* Readable and maintainable Python.
* Testable Sudoku logic independent of Flask.
* Thin Flask routes.
* Clear separation between backend game logic and frontend UI.
* Modern Python practices and type hints where useful.

Do not perform a complete rewrite unless the existing implementation makes it necessary. Prefer incremental refactoring that preserves working behavior.

---

## 3. Sudoku Requirements

### Board

The game uses a standard **9×9 Sudoku board** divided into nine **3×3 boxes**.

A valid Sudoku solution must contain:

* Numbers 1–9 in every row.
* Numbers 1–9 in every column.
* Numbers 1–9 in every 3×3 box.

### Puzzle Generation

Generate a complete valid Sudoku solution and remove cells to create the playable puzzle.

Support three difficulties:

* **Easy** — fewer cells removed / more prefilled cells.
* **Medium** — moderate number of prefilled cells.
* **Hard** — more cells removed / fewer prefilled cells.

The exact number of prefilled cells may be chosen by the implementation, provided the difficulty levels are meaningfully different.

### Unique Solution

Every generated puzzle must have **exactly one solution**.

The puzzle generator must validate uniqueness after removing cells.

If removing a cell creates multiple solutions, restore the cell and continue.

Do not return a puzzle with zero or multiple solutions.

The solver should be able to stop after finding two solutions because only uniqueness needs to be determined.

---

## 4. Game Features

### Difficulty Selector

The user must be able to select:

* Easy
* Medium
* Hard

Starting a new puzzle should generate a puzzle using the selected difficulty.

### User Input

Users can enter numbers into empty cells.

Prefilled cells must be read-only.

Hint-filled cells must also become locked.

Valid input values are integers from 1–9.

### Immediate Validation

Invalid moves should receive immediate visual feedback.

An entry is invalid when it violates Sudoku rules against the current board state, including conflicts in:

* Row
* Column
* 3×3 box

### Check Puzzle

Provide a **Check Puzzle** button.

When used:

* Compare user-entered values against the actual solution.
* Highlight incorrect entries.
* Do not mark empty cells as incorrect.
* Keep correct entries unchanged.

### Hint

Provide a **Hint** button.

When used:

* Find an empty cell.
* Fill it with the correct value from the solution.
* Lock that cell so it cannot be edited.
* Continue the timer.

### Completion

When all cells contain the correct values:

* Stop the timer.
* Display a clear completion message.
* Record the completion time for the leaderboard.

---

## 5. Timer

Each puzzle must have an elapsed-time timer.

The timer should:

* Start when a puzzle begins.
* Continue while the user plays.
* Stop when the puzzle is solved.
* Display elapsed time in a readable format such as `MM:SS`.

The final elapsed time is used for leaderboard scoring.

Avoid relying solely on the browser display for the authoritative completion time if doing so could make leaderboard data unreliable.

---

## 6. Leaderboard

Implement a **Top 10 Fastest Times** leaderboard.

Each score contains:

* Player name.
* Completion time.
* Difficulty.

The leaderboard must:

* Sort fastest times first.
* Contain at most 10 entries.
* Persist between browser sessions.
* Use browser `localStorage`.
* Survive page refreshes and reopening the application.

Leaderboard storage is client-side; a database is not required.

Validate stored leaderboard data before using it so malformed `localStorage` values do not break the application.

---

## 7. UI and Styling

The interface should be clean, readable, and responsive.

### Sudoku Grid

The grid must:

* Clearly show the 3×3 box boundaries.
* Use alternating styling for the 3×3 boxes.
* Clearly distinguish:

  * Prefilled cells
  * User entries
  * Incorrect entries
  * Hint-filled cells
  * Selected cells, where applicable

### Responsive Design

The application must work on:

* Desktop
* Tablet
* Mobile

The Sudoku board should scale appropriately without becoming unusable on small screens.

### Dark Mode

Provide a Dark Mode toggle.

Dark mode must apply consistently to the entire interface, including:

* Page background
* Grid
* Cells
* Text
* Buttons
* Inputs
* Leaderboard
* Feedback messages

Both light and dark modes must maintain readable contrast.

---

## 8. Architecture

Keep Sudoku logic independent from Flask wherever possible.

A suitable architecture is:

```text
app.py
sudoku/
    generator.py
    solver.py
    game.py
templates/
    index.html
static/
    css/
        style.css
    js/
        app.js
tests/
```

The existing project structure may be preserved if it is already well organized.

Responsibilities should generally be:

### `generator`

Responsible for:

* Creating valid completed boards.
* Creating puzzles from completed boards.
* Applying difficulty settings.
* Ensuring puzzle uniqueness.

### `solver`

Responsible for:

* Solving Sudoku boards.
* Checking whether a board is valid.
* Counting solutions / determining uniqueness.

### `game`

Responsible for:

* Game state.
* User moves.
* Hints.
* Completion checks.
* Interaction with Sudoku logic.

### Flask Application

Responsible primarily for:

* HTTP routes.
* Request handling.
* Serving templates/static files.
* Connecting frontend requests to game functionality.

### Frontend JavaScript

Responsible for:

* User interaction.
* Immediate input feedback.
* Timer display.
* Hint/check interactions.
* Dark mode.
* Leaderboard `localStorage`.
* UI state.

Avoid putting large amounts of Sudoku/business logic directly inside Flask routes or HTML templates.

---

## 9. Testing

Testing is an important part of the refactoring process.

Tests should cover at minimum:

* Sudoku board validity.
* Sudoku solving.
* Unique solution detection.
* Puzzle generation.
* Difficulty generation.
* Invalid moves.
* Completion detection.
* Hint correctness.
* Relevant game-state behavior.

Run the existing test suite before and after major refactoring.

Do not knowingly leave existing tests failing.

When changing behavior, update or add tests to reflect the intended behavior.

---

## 10. Code Quality

Follow these principles:

* Prefer simple solutions.
* Avoid unnecessary abstractions.
* Avoid duplicated logic.
* Keep functions focused.
* Use constants for configurable values.
* Validate external/user input.
* Handle malformed client-side storage safely.
* Avoid global mutable state where possible.
* Keep backend and frontend responsibilities clear.
* Use type hints where they improve readability.
* Add comments/docstrings for non-obvious logic, not for self-explanatory code.

Do not introduce new dependencies unless there is a clear reason.

---

## 11. Agent Workflow

When modifying the project:

1. Inspect the existing code and tests.
2. Understand the current architecture.
3. Identify the smallest safe refactoring or feature change.
4. Implement the change.
5. Run relevant tests.
6. Fix regressions before continuing.
7. Continue incrementally until all requirements are implemented.
8. Run the complete test suite at the end.
9. Verify that the Flask application starts successfully.
10. Perform a final review for duplicated, unnecessary, or overly complex code.

Do not remove existing functionality without a clear reason.

Human-only project activities such as Udacity screenshots, Copilot conversation screenshots, and final submission packaging are outside the scope of these agent instructions.
