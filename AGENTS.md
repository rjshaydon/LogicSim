# Repository Guidelines

## Project Structure & Module Organization
- `app.jsx` contains the entire React application (UI, state, and logic) in a single file.
- There are no separate `src/`, `tests/`, or asset directories at this time.
- Add new modules only if you plan to split the file; keep related logic grouped (e.g., helpers near usage).

## Build, Test, and Development Commands
- No build or test scripts are checked into this repo.
- To run locally, open `app.jsx` in the host environment you are using for React (for example, a sandbox or a bundler project you set up separately). If you add tooling, document the exact commands here.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; use semicolons and single quotes as in `app.jsx`.
- React components use PascalCase (e.g., `TailwindInjector`); helpers use camelCase (e.g., `snapToGrid`).
- Constants are uppercase (e.g., `GRID_SIZE`, `COLORS`).
- Keep functions small and colocated; prefer `useCallback`/`useMemo` for expensive or stable references.

## Testing Guidelines
- No automated tests are currently defined.
- If you add tests, document the framework, naming conventions, and commands (e.g., `*.test.jsx` in `tests/`).

## Commit & Pull Request Guidelines
- Commit history is minimal; the existing message uses a short summary with a colon (e.g., `Baseline: original app.jsx (pre-refactor)`). Follow that style for consistency.
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
– Don’t rename files.
– Don’t change formatting.”

## Run instructions: the exact commands to run tests/dev server (e.g. npm install, npm run dev, etc.)

## Safety
– Always show a plan first, then make changes if the user is happy; ask for confirmation.