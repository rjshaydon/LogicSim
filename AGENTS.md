# Repository Guidelines

## Project Structure & Module Organization
- `src/App.jsx` contains the full React application (UI, state, and logic).
- `src/components/` contains supporting UI components used by `src/App.jsx`.
- `index.html` is the standalone bundle generated from `src/` and is the file that runs in a browser.

## Build, Test, and Development Commands
- No build or test scripts are checked into this repo.
- To run locally, open `index.html` in a browser (it includes the app inline).
- For GitHub Pages or sharing a URL, commit the regenerated `index.html`.
- After editing code in `src/`, regenerate the standalone file with:
  `python3 scripts/regenerate_index.py`

## Coding Style & Naming Conventions
- Indentation: 2 spaces; use semicolons and single quotes as in `app.jsx`.
- React components use PascalCase (e.g., `TailwindInjector`); helpers use camelCase (e.g., `snapToGrid`).
- Constants are uppercase (e.g., `GRID_SIZE`, `COLORS`).
- Keep functions small and colocated; prefer `useCallback`/`useMemo` for expensive or stable references.

## Testing Guidelines
- No automated tests are currently defined.
- If you add tests, document the framework, naming conventions, and commands (e.g., `*.test.jsx` in `tests/`).

## Commit & Pull Request Guidelines
- Use short, descriptive commit messages (e.g., `Regenerate index.html`).
- PRs should include a brief description of the change, screenshots for UI adjustments, and any manual testing performed.

## Configuration & Security Notes
- Firebase initialization relies on runtime globals (`__firebase_config`, `__app_id`). Avoid hardcoding secrets in the repo.
- If you introduce config files or environment variables, document their names and required values here.

## Goal
- Work on LogicSim without rewriting the whole app.
- Refactor the app so that it can run as a standalone app without requiring a host environment; it should be able to run in a standard web browser from an html file.

## Constraints
- Make minimal, surgical changes.
- Don’t refactor unless asked to.
- Don’t rename files.
- Don’t change formatting.

## Run Instructions
- No test or dev server commands are configured.
- Regenerate the standalone HTML after edits: `python3 scripts/regenerate_index.py`
