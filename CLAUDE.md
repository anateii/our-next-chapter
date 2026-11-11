# Our Next Chapter (Ourly)

A shared space for a couple: goals, tasks, calendar, finances and check-ins.
React + TypeScript (Vite), Clerk for sign-in, Vercel functions in `api/`,
Drizzle ORM (`db/`).

## Where code goes

- **`src/helpers/`**: plain TypeScript (`.ts`), never JSX, never renders.
  API shapes and converters (`ApiX`, `fromApiX`), calculations and
  formatting, hooks that don't draw anything (`useTheme`, `usePeople`,
  `useApi`), browser behaviour (`motion.ts`, `glider.ts`). Referencing an
  icon component as data (e.g. a category → icon map) is fine; rendering is not.
- **`src/components/`**: everything that renders (`.tsx`). Components used
  by one area get a subfolder (`components/finances/`).
- **Exception:** logic used only by one component folder may live in that
  folder, next to the components that use it (e.g.
  `components/finances/useFinanceActions.ts`). Once a second area needs it,
  move it to `helpers/`.
- **`src/pages/`**: one file per page (plus its `.css`). A page lays out its
  components and owns the state they share; it should not hold each card's
  markup or logic.
- **Shared form/dialog pieces:** `components/dialogParts.tsx` (`FieldError`,
  `CloseButton`, `MoneyInput`) and `helpers/dialogs.ts` (`closeRef`,
  `useSession`). Use these; don't copy them into new files.
- A `.tsx` file exports only components (types are fine); plain functions go
  in a `.ts` file. The react-refresh lint rule enforces this.

## Other conventions

- **CSS:** one stylesheet per page (`pages/X.css`); shared rules and tokens
  in `App.css` / `index.css`. Use the colour tokens (`var(--accent)` etc.),
  and give dark mode its own values.
- **API:** the Vercel Hobby plan allows 12 functions, so endpoints group
  related actions by `type`/`action` in one file (e.g. `api/ourspace.ts`)
  instead of adding new files.
- **Motion:** animate tab, filter and layout changes with `smoothly()` from
  `helpers/motion.ts`; it respects "Reduce motion".

## Checks

```sh
npx tsc --noEmit -p tsconfig.app.json   # types (src/)
npx eslint src
npx vite build
```

`tsconfig` doesn't cover `api/`; type-check changed API files on their own.
