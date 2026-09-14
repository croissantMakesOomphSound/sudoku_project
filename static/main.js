// Client-side rendering and interaction for the Flask-backed Sudoku game.
const SIZE = 9;
const LEADERBOARD_KEY = 'sudokuTop10';

let puzzle = [];
let difficulty = 'medium';
let timerInterval = null;
let elapsedSeconds = 0;
let isPaused = false;
let gameCompleted = false;
let noteMode = false;
let selectedNumber = null;
let solverRunning = false;
let hintsUsed = 0;
const TIMER_WARNING_SECONDS = 3600;

function initializeTheme() {
  const isDarkMode = localStorage.getItem('theme') === 'dark';
  if (isDarkMode) document.body.classList.add('dark-mode');
  updateThemeIcon(isDarkMode);
}

function updateThemeIcon(isDark) {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');
  themeToggle.classList.toggle('dark', isDark);
  themeIcon.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  updateThemeIcon(isDarkMode);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  document.getElementById('timer-value').textContent = formatTime(elapsedSeconds);
  document.querySelector('.timer-line').classList.toggle('timer-warning', elapsedSeconds > TIMER_WARNING_SECONDS);
}

function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  isPaused = false;
  gameCompleted = false;
  updateTimerDisplay();
  updatePauseButton();
  timerInterval = setInterval(() => {
    if (!isPaused && !gameCompleted) {
      elapsedSeconds += 1;
      updateTimerDisplay();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function pauseGame() {
  if (gameCompleted || solverRunning) return;
  isPaused = true;
  updatePauseButton();
  showPauseOverlay();
}

function resumeGame() {
  if (gameCompleted) return;
  isPaused = false;
  updatePauseButton();
  hidePauseOverlay();
}

function togglePause() {
  if (gameCompleted) return;
  isPaused ? resumeGame() : pauseGame();
}

function updatePauseButton() {
  const pauseBtn = document.getElementById('pause-resume');
  const icon = pauseBtn.querySelector('.pause-icon');
  pauseBtn.disabled = gameCompleted;
  if (isPaused) {
    pauseBtn.classList.add('paused');
    icon.textContent = '▶️';
    pauseBtn.title = 'Resume game (Space)';
    pauseBtn.setAttribute('aria-label', 'Resume game');
  } else {
    pauseBtn.classList.remove('paused');
    icon.textContent = '⏸️';
    pauseBtn.title = 'Pause game (P)';
    pauseBtn.setAttribute('aria-label', 'Pause game');
  }
}

function showPauseOverlay() {
  const overlay = document.getElementById('pause-overlay');
  document.getElementById('pause-time').textContent = formatTime(elapsedSeconds);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hidePauseOverlay() {
  const overlay = document.getElementById('pause-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

// Sudoku board and note mode.
function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';

  for (let row = 0; row < SIZE; row += 1) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';

    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell-wrapper';
      if ((Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 1) cell.classList.add('box-shade');

      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.className = 'sudoku-cell';
      input.dataset.row = row;
      input.dataset.col = col;
      input.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`);

      const notes = document.createElement('div');
      notes.className = 'notes-grid';
      notes.setAttribute('aria-hidden', 'true');
      for (let number = 1; number <= SIZE; number += 1) {
        const note = document.createElement('span');
        note.dataset.note = number;
        notes.appendChild(note);
      }

      input.addEventListener('input', handleInput);
      input.addEventListener('focus', () => highlightRelatedCells(row, col));
      input.addEventListener('click', () => {
        if (input.value) selectNumber(Number(input.value));
      });
      cell.appendChild(notes);
      cell.appendChild(input);
      rowDiv.appendChild(cell);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function getInput(row, col) {
  return document.querySelector(`.sudoku-cell[data-row="${row}"][data-col="${col}"]`);
}

function getCellWrapper(row, col) {
  const input = getInput(row, col);
  return input ? input.parentElement : null;
}

function getNotes(row, col) {
  const wrapper = getCellWrapper(row, col);
  if (!wrapper) return new Set();
  return new Set(Array.from(wrapper.querySelectorAll('.notes-grid span.note-active')).map((node) => Number(node.dataset.note)));
}

function setNotes(row, col, notes) {
  const wrapper = getCellWrapper(row, col);
  if (!wrapper) return;
  wrapper.querySelectorAll('.notes-grid span').forEach((node) => {
    node.classList.toggle('note-active', notes.has(Number(node.dataset.note)));
  });
}

function handleInput(event) {
  const input = event.target;
  if (input.disabled || isPaused || gameCompleted || solverRunning) return;
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const value = input.value.replace(/[^1-9]/g, '').slice(0, 1);
  input.value = '';

  if (noteMode && value) {
    toggleNote(row, col, Number(value));
    return;
  }

  setNotes(row, col, new Set());
  if (!value) {
    input.classList.remove('incorrect', 'conflict', 'valid-entry');
    input.removeAttribute('aria-invalid');
    applyConflictHighlighting(findConflictingCells(readBoard()));
    updateNumberTracker();
    return;
  }

  input.value = value;
  input.classList.remove('incorrect', 'valid-entry');
  input.removeAttribute('aria-invalid');
  const num = Number(value);

  // Recalculate conflicts across the whole board so every conflicting cell,
  // including a prefilled clue, receives immediate visual feedback.
  const conflicts = findConflictingCells(readBoard());
  applyConflictHighlighting(conflicts);

  if (conflicts.has(row * SIZE + col)) {
    setMessage('That number conflicts with the current row, column, or 3×3 box.', false);
  } else {
    input.classList.add('valid-entry');
    clearMessage();
    selectNumber(num);
    checkForCompletion();
  }
  updateNumberTracker();
}

function toggleNote(row, col, number) {
  const input = getInput(row, col);
  if (!input || input.disabled || input.value) return;
  const notes = getNotes(row, col);
  if (notes.has(number)) notes.delete(number); else notes.add(number);
  setNotes(row, col, notes);
  setMessage(`Note ${number} ${notes.has(number) ? 'added' : 'removed'} from row ${row + 1}, column ${col + 1}.`, true);
}

function toggleNoteMode() {
  noteMode = !noteMode;
  const button = document.getElementById('note-mode');
  button.setAttribute('aria-pressed', String(noteMode));
  button.textContent = `Note Mode: ${noteMode ? 'On' : 'Off'}`;
  button.classList.toggle('active', noteMode);
  setMessage(noteMode ? 'Note Mode is on. Enter a number to toggle a note.' : 'Note Mode is off.', true);
}

function readBoard() {
  const inputs = document.querySelectorAll('#sudoku-board input.sudoku-cell');
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  inputs.forEach((input) => {
    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);
    board[row][col] = input.value ? Number(input.value) : 0;
  });
  return board;
}

function findConflictingCells(board) {
  const conflicts = new Set();

  // Rows and columns.
  for (let row = 0; row < SIZE; row += 1) {
    const seen = new Map();
    for (let col = 0; col < SIZE; col += 1) {
      const value = board[row][col];
      if (!value) continue;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(row * SIZE + col);
    }
    seen.forEach((cells) => {
      if (cells.length > 1) cells.forEach((index) => conflicts.add(index));
    });
  }

  for (let col = 0; col < SIZE; col += 1) {
    const seen = new Map();
    for (let row = 0; row < SIZE; row += 1) {
      const value = board[row][col];
      if (!value) continue;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(row * SIZE + col);
    }
    seen.forEach((cells) => {
      if (cells.length > 1) cells.forEach((index) => conflicts.add(index));
    });
  }

  // 3×3 boxes.
  for (let boxRow = 0; boxRow < SIZE; boxRow += 3) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += 3) {
      const seen = new Map();
      for (let row = boxRow; row < boxRow + 3; row += 1) {
        for (let col = boxCol; col < boxCol + 3; col += 1) {
          const value = board[row][col];
          if (!value) continue;
          if (!seen.has(value)) seen.set(value, []);
          seen.get(value).push(row * SIZE + col);
        }
      }
      seen.forEach((cells) => {
        if (cells.length > 1) cells.forEach((index) => conflicts.add(index));
      });
    }
  }

  return conflicts;
}

function applyConflictHighlighting(conflicts) {
  document.querySelectorAll('#sudoku-board .sudoku-cell').forEach((input, index) => {
    input.classList.toggle('conflict', conflicts.has(index));
    if (conflicts.has(index)) input.setAttribute('aria-invalid', 'true');
    else if (!input.classList.contains('incorrect')) input.removeAttribute('aria-invalid');
  });
}

function isMoveSafe(board, row, col, num) {
  for (let i = 0; i < SIZE; i += 1) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const startRow = row - (row % 3);
  const startCol = col - (col % 3);
  for (let r = startRow; r < startRow + 3; r += 1) {
    for (let c = startCol; c < startCol + 3; c += 1) {
      if (board[r][c] === num) return false;
    }
  }
  return true;
}

function highlightRelatedCells(row, col) {
  document.querySelectorAll('.sudoku-cell.selected, .sudoku-cell.related').forEach((cell) => {
    cell.classList.remove('selected', 'related');
  });
  document.querySelectorAll('.sudoku-cell').forEach((cell) => {
    const cellRow = Number(cell.dataset.row);
    const cellCol = Number(cell.dataset.col);
    if (cellRow === row && cellCol === col) cell.classList.add('selected');
    if (cellRow === row || cellCol === col ||
        (Math.floor(cellRow / 3) === Math.floor(row / 3) && Math.floor(cellCol / 3) === Math.floor(col / 3))) {
      cell.classList.add('related');
    }
  });
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const inputs = document.querySelectorAll('#sudoku-board input.sudoku-cell');
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const input = inputs[row * SIZE + col];
      const value = puzzle[row][col];
      if (value !== 0) {
        input.value = value;
        input.disabled = true;
        input.classList.add('prefilled');
      }
    }
  }
  selectedNumber = null;
  updateNumberTracker();
}

function createNumberButtons() {
  const container = document.getElementById('number-buttons');
  container.innerHTML = '';
  for (let number = 1; number <= SIZE; number += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'number-button';
    button.dataset.number = number;
    button.innerHTML = `<span class="tracker-number">${number}</span><span class="tracker-count">0/9</span>`;
    button.setAttribute('aria-label', `Highlight number ${number}`);
    button.addEventListener('click', () => selectNumber(number));
    container.appendChild(button);
  }
}

function selectNumber(number) {
  selectedNumber = Number(number);
  document.querySelectorAll('.number-button').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.number) === selectedNumber);
  });
  updateNumberTracker();
  document.querySelectorAll('.sudoku-cell.number-highlight').forEach((cell) => cell.classList.remove('number-highlight'));
  if (!selectedNumber) return;
  document.querySelectorAll('.sudoku-cell').forEach((input) => {
    if (Number(input.value) === selectedNumber) input.classList.add('number-highlight');
  });
}

function updateNumberTracker() {
  const counts = Array(SIZE + 1).fill(0);
  document.querySelectorAll('.sudoku-cell').forEach((input) => {
    const value = Number(input.value);
    if (value >= 1 && value <= 9) counts[value] += 1;
  });

  document.querySelectorAll('.number-button').forEach((button) => {
    const number = Number(button.dataset.number);
    const count = counts[number];
    button.querySelector('.tracker-count').textContent = `${count}/9`;
    button.classList.toggle('complete', count === 9);
    button.setAttribute('aria-label', `Highlight number ${number}; ${count} of 9 used`);
  });

  if (selectedNumber) {
    const count = counts[selectedNumber];
    document.getElementById('tracker-status').textContent = count === 9
      ? `All nine ${selectedNumber}s have been used.`
      : `${count} of 9 ${selectedNumber}s used. ${9 - count} remaining.`;
  }
}

async function newGame() {
  const selectedDifficulty = document.getElementById('difficulty').value;
  setMessage('Generating puzzle…', false);
  hintsUsed = 0;
  document.getElementById('new-game').disabled = true;
  solverRunning = false;
  try {
    const res = await fetch(`/new?difficulty=${encodeURIComponent(selectedDifficulty)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Unable to generate puzzle');
    difficulty = data.difficulty || selectedDifficulty;
    document.getElementById('difficulty').value = difficulty;
    renderPuzzle(data.puzzle);
    hidePauseOverlay();
    startTimer();
    document.getElementById('solver-status').textContent = 'Watch a backtracking solver find the solution.';
    document.getElementById('solver-progress-bar').style.width = '0%';
    clearMessage();
    displayScores(false);
  } catch (error) {
    setMessage(`Unable to start a new game: ${error.message}`, false);
  } finally {
    document.getElementById('new-game').disabled = false;
  }
}

async function checkSolution() {
  if (gameCompleted || isPaused || solverRunning) return;
  const board = readBoard();
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    setMessage(data.error || 'Unable to check the puzzle.', false);
    return;
  }
  const incorrect = new Set(data.incorrect.map(([row, col]) => row * SIZE + col));
  document.querySelectorAll('#sudoku-board input').forEach((input, index) => {
    if (input.disabled) {
      input.classList.remove('incorrect');
      return;
    }
    input.classList.remove('incorrect');
    if (incorrect.has(index)) input.classList.add('incorrect');
  });
  applyConflictHighlighting(findConflictingCells(board));
  if (data.solved) {
    completeGame(data.elapsed_seconds);
  } else if (incorrect.size === 0) {
    setMessage('So far, all entered values are correct. Keep going!', true);
  } else {
    setMessage(`${incorrect.size} incorrect entr${incorrect.size === 1 ? 'y' : 'ies'} highlighted.`, false);
  }
}

async function requestHint() {
  if (gameCompleted || isPaused || solverRunning) return;
  const board = readBoard();
  const res = await fetch('/hint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    setMessage(data.error || 'Unable to provide a hint.', false);
    return;
  }
  const input = getInput(data.row, data.col);
  if (!input) return;
  hintsUsed += 1;
  input.value = data.value;
  input.disabled = true;
  input.classList.add('hint-filled');
  input.classList.remove('incorrect', 'valid-entry');
  setNotes(data.row, data.col, new Set());
  input.setAttribute('aria-label', `Row ${data.row + 1}, Column ${data.col + 1}, hint value ${data.value}`);
  selectNumber(data.value);
  updateNumberTracker();
  setMessage('Hint added. The hinted cell is now locked.', true);
  checkForCompletion();
}

async function checkForCompletion() {
  if (gameCompleted) return;
  const board = readBoard();
  if (board.some((row) => row.some((value) => value === 0))) return;
  const res = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board })
  });
  const data = await res.json();
  if (res.ok && data.solved) completeGame(data.elapsed_seconds);
}

function completeGame(serverElapsed) {
  if (gameCompleted) return;
  gameCompleted = true;
  stopTimer();
  isPaused = false;
  hidePauseOverlay();
  updatePauseButton();
  if (Number.isFinite(serverElapsed)) elapsedSeconds = Math.max(elapsedSeconds, serverElapsed);
  updateTimerDisplay();
  setMessage('Congratulations! You solved the puzzle!', true);
  showScoreSubmitModal();
}

// Leaderboard: persistent browser-side storage.
function getLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.time)) &&
      ['easy', 'medium', 'hard'].includes(entry.difficulty))
      .map((entry) => {
        const parsedHints = Number(entry.hintsUsed ?? entry.hints ?? 0);
        return {
          name: entry.name.slice(0, 50),
          time: Math.max(0, Math.floor(Number(entry.time))),
          difficulty: entry.difficulty,
          hintsUsed: Number.isFinite(parsedHints) ? Math.max(0, Math.floor(parsedHints)) : 0
        };
      })
      .sort((a, b) => a.time - b.time).slice(0, 10);
  } catch (error) {
    localStorage.removeItem(LEADERBOARD_KEY);
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 10)));
}

function addLeaderboardEntry(name, time, level, hintCount = hintsUsed) {
  const entries = getLeaderboard();
  entries.push({ name: name.slice(0, 50), time, difficulty: level, hintsUsed: Math.max(0, Math.floor(Number(hintCount) || 0)) });
  entries.sort((a, b) => a.time - b.time);
  saveLeaderboard(entries);
}

function displayScores(showMessage = true) {
  const scoresList = document.getElementById('scores-list');
  const scores = getLeaderboard();
  if (scores.length === 0) {
    scoresList.innerHTML = '<p class="empty-scores">No scores yet. Solve a puzzle to enter the leaderboard.</p>';
  } else {
    const rows = scores.map((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
      return `<tr class="${index < 3 ? 'top-three' : ''}">
        <td>${medal} ${index + 1}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${capitalize(entry.difficulty)}</td>
        <td>${entry.hintsUsed}</td>
        <td>${formatTime(entry.time)}</td>
      </tr>`;
    }).join('');
    scoresList.innerHTML = `<table class="score-table">
      <thead><tr><th>#</th><th>Name</th><th>Difficulty</th><th>Hints</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  if (showMessage) setMessage('Leaderboard updated.', true);
}

function clearScores() {
  if (!getLeaderboard().length) return;
  if (window.confirm('Clear all saved Sudoku scores from this browser?')) {
    localStorage.removeItem(LEADERBOARD_KEY);
    displayScores();
  }
}

function showScoreSubmitModal() {
  document.getElementById('final-time').textContent = formatTime(elapsedSeconds);
  document.getElementById('final-difficulty').textContent = capitalize(difficulty);
  const overlay = document.getElementById('score-submit-overlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('player-name').focus();
}

function hideScoreSubmitModal() {
  const overlay = document.getElementById('score-submit-overlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.getElementById('player-name').value = '';
}

function submitScore() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) {
    setMessage('Please enter your name to save the score.', false);
    return;
  }
  addLeaderboardEntry(name, elapsedSeconds, difficulty, hintsUsed);
  hideScoreSubmitModal();
  displayScores();
}

// Visual backtracking solver. It works from the current board and animates its decisions.
async function runSolverAnimation() {
  if (solverRunning || gameCompleted || isPaused) return;
  solverRunning = true;
  const status = document.getElementById('solver-status');
  const progress = document.getElementById('solver-progress-bar');
  const board = readBoard();
  const steps = [];
  const original = board.map((row) => row.slice());

  function isValid(boardState, row, col, num) {
    return isMoveSafe(boardState, row, col, num);
  }

  function solve() {
    let best = null;
    let bestCandidates = null;
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (board[row][col] !== 0) continue;
        const candidates = [];
        for (let num = 1; num <= SIZE; num += 1) if (isValid(board, row, col, num)) candidates.push(num);
        if (!candidates.length) return false;
        if (!best || candidates.length < bestCandidates.length) {
          best = [row, col];
          bestCandidates = candidates;
        }
      }
    }
    if (!best) return true;
    const [row, col] = best;
    for (const num of bestCandidates) {
      board[row][col] = num;
      steps.push({ row, col, value: num, action: 'try' });
      if (solve()) return true;
      board[row][col] = 0;
      steps.push({ row, col, value: 0, action: 'backtrack' });
    }
    return false;
  }

  status.textContent = 'Solving…';
  const solved = solve();
  if (!solved) {
    status.textContent = 'The current entries cannot be solved.';
    solverRunning = false;
    return;
  }

  const maxSteps = Math.max(1, steps.length);
  for (let index = 0; index < steps.length; index += 1) {
    if (!solverRunning) break;
    const step = steps[index];
    const input = getInput(step.row, step.col);
    if (input && !input.disabled) {
      input.classList.add(step.action === 'backtrack' ? 'solver-backtrack' : 'solver-step');
      input.value = step.value || '';
      setTimeout(() => input.classList.remove('solver-step', 'solver-backtrack'), 150);
    }
    progress.style.width = `${((index + 1) / maxSteps) * 100}%`;
    await sleep(Math.min(35, Math.max(8, 3000 / maxSteps)));
  }

  // Restore the player's board; the animation is a demonstration, not a game shortcut.
  original.forEach((row, r) => row.forEach((value, c) => {
    const input = getInput(r, c);
    if (input && !input.disabled) input.value = value || '';
  }));
  progress.style.width = '100%';
  status.textContent = 'Solver demonstration complete. Your puzzle entries were restored.';
  solverRunning = false;
  updateNumberTracker();
  if (selectedNumber) selectNumber(selectedNumber);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setMessage(text, success) {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.classList.toggle('success', Boolean(success));
}

function clearMessage() {
  setMessage('', false);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (match) => map[match]);
}

window.addEventListener('load', () => {
  initializeTheme();
  createNumberButtons();
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('difficulty').addEventListener('change', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('hint').addEventListener('click', requestHint);
  document.getElementById('note-mode').addEventListener('click', toggleNoteMode);
  document.getElementById('solver-animation').addEventListener('click', runSolverAnimation);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('pause-resume').addEventListener('click', togglePause);
  document.getElementById('resume-button').addEventListener('click', resumeGame);
  document.getElementById('clear-scores').addEventListener('click', clearScores);
  document.getElementById('submit-score-btn').addEventListener('click', submitScore);
  document.getElementById('skip-score-btn').addEventListener('click', hideScoreSubmitModal);
  document.getElementById('player-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitScore();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, button')) return;
    if (event.key === 'p' || event.key === 'P') togglePause();
    if (event.key === ' ' && isPaused) {
      event.preventDefault();
      resumeGame();
    }
  });
  displayScores(false);
  newGame();
});
