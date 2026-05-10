# AGENTS.md

Project guidance for agents and contributors working in this repo.

## Tooling

- Prefer `bun` for package management and script execution.
- Use `bun install` instead of `npm install`.
- Use `bun run <script>` when possible.
- Only fall back to `npm` if a task is explicitly Electron Forge-specific and `bun` does not work correctly in practice.

## TypeScript

- Never use the `any` type.
- Prefer `unknown` for unsafe input and narrow it explicitly.
- Reuse shared types from `src/types.ts` instead of redefining shapes.
- Keep functions small and typed at the boundary.

## React

- Do not put major app logic into one file.
- Prefer splitting code into:
  - `components/` for UI
  - `utils/` for pure helpers
  - `types.ts` for shared types
- Keep presentation components focused and move data parsing / recurrence logic into utilities.
- Preserve the current visual style unless the task explicitly asks for a redesign.

## Styling

- Keep the existing dark theme and spacing language.
- Prefer extending current classes over introducing a totally different styling pattern.
- Avoid flashy UI changes unless requested.

## File safety

- Do not remove user functionality during refactors.
- Keep Obsidian `.md` compatibility intact.
- Be careful with recurring-event generation and file deletion paths.

## Quality checks

- Run lint after meaningful code changes.
- Run packaging/build checks for changes that affect the Electron app.
- Prefer small, verifiable changes over broad rewrites.
