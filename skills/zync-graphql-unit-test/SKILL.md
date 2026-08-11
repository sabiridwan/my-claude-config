---
name: zync-graphql-unit-test
description: Use when a zync-nestjs GraphQL resolver (Resolver/ResolveField/Query/Mutation) is added or changed and lacks Jest coverage, when a zync-nextjs or zync-expo Context provider (context.tsx wrapping GraphQL queries/mutations) is added or changed and lacks coverage, when auditing a project for missing *.resolver.spec.ts / context.spec.tsx files, or when the user asks to "test all resolvers", "add unit tests", "cover the GraphQL layer", or catch GraphQL-wiring breaking changes before deploy instead of after.
---

# Zync GraphQL Unit Test

## Overview

Generates and maintains Jest unit tests for the GraphQL entry-point layer across the Zync stack:

- **Backend (zync-nestjs):** every resolver class in `*.resolver.ts` (NestJS 9 + Apollo GraphQL code-first + Mongoose).
- **Frontend (zync-nextjs / zync-nextjs-standalone / zync-expo):** every `context.tsx` that owns GraphQL calls via a `use<Feature>Query()` hook.

Both are "thin wiring" layers with the same failure mode: a changed arg, a renamed field, a flipped condition slips through because nothing exercises the call. Closes that gap by testing the layer directly, not the transport underneath it (no real Mongo, no real Apollo network calls).

Backend and frontend need genuinely different harnesses (NestJS DI vs React hooks) — see the two workflows below. Pick the one matching the file that changed.

Core principle, same on both sides: **mock the layer directly below the one under test** (the injected service for a resolver; the `gql/query.ts` hook for a context) — assert the right call happened with the right args, and that the response is threaded through correctly.

## When to Use

- Resolver file created or edited (`*.resolver.ts`) and no matching `*.resolver.spec.ts` exists, or the spec is stale relative to the resolver.
- Frontend `context.tsx` created or edited (zync-nextjs / zync-nextjs-standalone / zync-expo) and no matching `context.spec.tsx` exists.
- User asks to sweep a whole project for coverage ("test all resolvers", "cover graphql layer", "add unit tests to the admin/app").
- Setting this up as a pre-deploy / CI gate so a broken resolver or context fails `npm test`, not production.

**Not for:** service/repository unit tests on the backend (different layer, different mock shape — services mock repositories, not the other way around), component/UI rendering tests on the frontend (this skill stops at the Context layer — no `screen.getByText`, no user-interaction simulation), e2e/integration tests that hit a real DB or real network (`test/*.e2e.ts` — separate concern), or DTO/schema validation tests.

---

# Backend: NestJS Resolvers

## Core Pattern

Resolvers in this stack are thin: they call one or two injected services and pass through args/return values. The test proves exactly that — nothing more. Do not test framework decorators (`@ApGqlAuthorize`, `@AuditMeta`) or NestJS's own DI; those are covered by e2e/guard tests elsewhere. Do not open a real Mongo connection or import `AppModule`.

```ts
// Minimal shape — see templates/resolver.spec.template.ts for the full worked example
const module: TestingModule = await Test.createTestingModule({
  providers: [
    EmployeeResolver,
    { provide: EmployeeService, useValue: { findById: jest.fn(), create: jest.fn() /* only methods the resolver calls */ } },
    { provide: AuthService, useValue: { signIn: jest.fn() } },
  ],
}).compile();

resolver = module.get(EmployeeResolver);
```

Then per method: `it('calls <service>.<method> with resolver args and returns its result', ...)`.

## Backend Workflow

### 1. Discover resolvers needing coverage

```bash
find src/modules -name "*.resolver.ts"
```

For each, check for a sibling `<name>.resolver.spec.ts`. A resolver "needs coverage" if:
- No spec file exists, OR
- `git diff <base>...HEAD --name-only` shows the resolver changed but its spec didn't (staleness signal for a targeted sweep, not a hard rule).

For a full-project sweep, batch resolvers by module and work through them one file at a time — don't try to generate all specs in one giant pass; verify each compiles and passes before moving to the next.

### 2. Read the resolver file

For each `export class XxxResolver` (a `.resolver.ts` file commonly exports multiple resolver classes, e.g. `EmployeePageResolver`, `EmployeeProfileResolver`, `EmployeeResolver` — one `describe` per class):

- **Constructor deps** → these are the providers to mock. Note `@Inject(forwardRef(() => X))` — mock the same way, forwardRef is irrelevant once compiled in the test module (just provide `X` directly).
- **Base class** → if it `extends ApBaseResolver`, don't re-test inherited `key`/`canUpdate`/`canDelete` per resolver; those are covered once in a shared spec if truly needed, not per subclass.
- **Each `@Query`/`@Mutation`/`@ResolveField` method** → note its args (`@Args`, `@Parent`, `@GqlCurrentUser`), which service method(s) it calls, and what it returns (passthrough, mapped, or computed inline with no service call — e.g. `branchTabEnabled` in `EmployeeProfileResolver` is pure logic on `@Parent()`, no service, so mock nothing and just assert the branching).

### 3. Generate the spec

Follow `templates/resolver.spec.template.ts` exactly for structure. Rules:

| Situation | Rule |
|---|---|
| Resolver class has `@ApGqlAuthorize()` (most do) | **Required**, not optional: `.overrideGuard(GqlRolesGuard).useValue({ canActivate: () => true })` on the `Test.createTestingModule({...})` chain, before `.compile()`. `@ApGqlAuthorize()` applies `@UseGuards(GqlRolesGuard)`, and Nest's `TestingModule` eagerly instantiates guards at `.compile()` time — not lazily per-request. Without the override, `.compile()` succeeds but every method call throws `Nest can't resolve dependencies of the GqlRolesGuard (Reflector, ?, ApContextService, GqlPermissionGuard)`, because the guard's own constructor deps aren't in the test module. Import `GqlRolesGuard` from the project's auth guards barrel (e.g. `../auth/guards`). |
| Injected service | `{ provide: ServiceClass, useValue: { methodUsed: jest.fn() } }` — only stub methods the resolver actually calls, not the whole service surface |
| `@GqlCurrentUser() user` param | Pass a plain mock object, e.g. `{ _id: 'user-1' }`, directly as the method arg — no need to mock a decorator |
| `@Parent() parent: SomeDto` | Build a minimal plain object with only the fields the method reads |
| `TransactionManager` dependency | `{ provide: TransactionManager, useValue: { withRetryTransaction: jest.fn((cb) => cb()) } }` — same pattern as existing service specs |
| `ApContextService` dependency | `{ provide: ApContextService, useValue: {} }` unless the method reads a specific field off it, then stub that field |
| Method with no service call (pure logic on `@Parent()` / args) | No providers needed for that logic — test both branches directly |
| Mutation/Query that just passes through (`return this.svc.x(args)`) | One happy-path test asserting the call args + `toEqual` on the return value is enough — don't invent business assertions the resolver doesn't make |
| Error path | Only add a `.mockRejectedValue` / `rejects.toThrow` test if the resolver does its own try/catch or transforms the error — a pure passthrough resolver doesn't need a duplicate error test, the service's own spec already covers that |

Import the concrete provider classes (not interfaces) exactly as the resolver imports them — module path and casing must match, including relative vs `src/`-rooted imports (this project's Jest `moduleNameMapper` maps `^src/(.*)$` to `<rootDir>/$1`, so both styles resolve).

### 4. Verify

```bash
TZ=UTC TS_JEST_DISABLE_VER_CHECKER=1 npx jest <path-to-spec> --silent
npx tsc --noEmit
```

Fix compile errors (usually a missing mock method or wrong import path) before moving to the next resolver. A spec that doesn't compile is worse than no spec — it blocks CI for everyone.

### 5. Report

After a sweep, report: resolvers covered this run, resolvers skipped and why (e.g. trivial pure-logic resolver intentionally left thin), and the resulting `find src/modules -name "*.resolver.ts" | wc -l` vs `*.resolver.spec.ts` count so coverage gap is visible.

## Backend Common Mistakes

- **Skipping `.overrideGuard(GqlRolesGuard)`** on any `@ApGqlAuthorize()` resolver — `.compile()` looks like it succeeded, then every single test fails with a DI-resolution error that has nothing to do with your mocks. This is the single most common first-run failure; see the table above.
- **Assuming sibling ResolveFields share the same true/false polarity.** `EmployeeProfileResolver` has both `branchTabEnabled` (SALESMAN/SHOP_MANAGER → `false`, others → `true`) and `branches`/`branchIds` (SALESMAN/SHOP_MANAGER → real value, others → `[]`) guarded by the identical-looking `if (!this.groups.includes(employee.group)) { ... }` condition, but with opposite bodies. Trace each method's actual `if`/`return` literally — don't pattern-match on the neighboring method's expected values.
- **Mocking the whole service class** instead of only the methods called — makes tests brittle to unrelated service changes and hides which calls actually matter.
- **Testing `@ApGqlAuthorize` / `@AuditMeta` behavior** in a resolver spec — these are cross-cutting decorators, not resolver logic; test them once at the guard/interceptor level, not per resolver.
- **Asserting on GraphQL wiring** (`@Query(() => X, { name: 'y' })` metadata) — that's compile-time schema generation (`schema.gql`), already covered by `src/schema.spec.ts`-style checks. Test behavior, not decorators.
- **Skipping `ResolveField` methods** because they "just format data" — these are exactly where silent breaking changes (renamed field, null-unsafe access) slip through; they need the same coverage as `Query`/`Mutation`.
- **Real DB/network calls** in a resolver spec — if a mock is missing and a method throws `Cannot read property of undefined` on a real service call, that's a sign a provider wasn't mocked, not a reason to reach for `MongoMemoryServer`.

---

# Frontend: Context Layer (zync-nextjs / zync-nextjs-standalone / zync-expo)

Per the zync-nextjs/zync-expo standard, `context.tsx` is the *only* file that calls `use<Feature>Query()` (which wraps Apollo's `useQuery`/`useLazyQuery`/`useMutation`); components only ever consume `use<Feature>State()`. That makes the Context provider's exposed methods the frontend equivalent of a resolver — the layer where a wrong variable name, dropped arg, or broken state update silently breaks a screen. Test that layer, mocking the `gql/query.ts` hook underneath it.

Most zync-nextjs/zync-nextjs-standalone/zync-expo projects have **zero Jest setup** — check before assuming infra exists.

## Step 0 — Scaffold Jest if missing

Check for a `"test"` script and a `jest` config (`jest.config.js` or a `"jest"` key in `package.json`) before anything else. If absent, this is a new dependency addition — flag it, don't add it silently.

**Next.js (13+, App or Pages router):**
```bash
pnpm add -D jest jest-environment-jsdom @testing-library/react @types/jest
```
```js
// jest.config.js — next/jest handles the SWC/TS transform, no babel config needed
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  moduleNameMapper: {
    // Only add this if tsconfig.json has a "@/*" (or similar) path alias — next/jest
    // does NOT read tsconfig `paths` automatically. Match it exactly (check baseUrl).
    '^@/(.*)$': '<rootDir>/src/$1',
  },
});
```
Add `"test": "jest"` to `package.json` scripts.

**Expo (zync-expo):**
```bash
npx expo install jest-expo --dev   # resolves the version matching this project's SDK — don't hand-pick a version
pnpm add -D @testing-library/react-native @types/jest
```
```jsonc
// package.json
"jest": {
  "preset": "jest-expo",
  "testMatch": ["**/*.spec.ts", "**/*.spec.tsx"],
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" } // match this project's tsconfig path alias
}
```
Add `"test": "jest"` to `package.json` scripts.

## Frontend Core Pattern

```tsx
// Minimal shape — see templates/frontend-context.spec.template.tsx for the full worked example.
// ALWAYS use a factory mock, never bare jest.mock(path) automock — see Common Mistakes.
jest.mock('./gql/query', () => ({ useEmployeeQuery: jest.fn() }));
jest.mock('../../services', () => ({ toastSvc: { success: jest.fn(), graphQlError: jest.fn() } }));

const mockFetchEmployee = jest.fn();
(useEmployeeQuery as jest.Mock).mockReturnValue({ fetchEmployee: mockFetchEmployee /* ... */ });

const { result } = await renderHook(() => useEmployeeState(), { wrapper: EmployeeContextProvider });
// Next.js: renderHook from '@testing-library/react' is SYNC — no await.
// Expo: renderHook from '@testing-library/react-native' v13+ is ASYNC — must await.

await act(async () => {
  await result.current.fetchEmployeePage({ page: 1, pageSize: 20 });
});

expect(mockFetchEmployee).toHaveBeenCalledWith(/* ... */);
expect(result.current.employee).toEqual(/* ... */);
```

## Frontend Workflow

### 1. Discover contexts needing coverage
```bash
find src/modules -name "context.tsx"
```
Check for a sibling `context.spec.tsx`. Same staleness signal as the backend (missing, or resolver changed but spec didn't).

### 2. Read the context file, then its `gql/query.ts`

- **State shape** → the `I<Feature>State` interface lists every method the context exposes; each one is a test target.
- **The `use<Feature>Query()` hook** (usually in `./gql/query.ts`, sometimes inlined directly in `context.tsx`) → open it and check **how each operation is returned**, because it varies per module:
  - Named-object shape: `return { fetchEmployee: fetchEmployee[0], createEmployee: createEmployee[0] }` → mock as `{ fetchEmployee: jest.fn(), createEmployee: jest.fn() }`, called as `employeeQ.fetchEmployee(...)`.
  - Raw tuple passthrough: `useLazyQuery(...)` returned as-is (e.g. `useItemGroupFilterOptions` in msgld-fe) → mock as `[jest.fn(), {}]`, called as `queryResult[0]()`.
  Mismatching this shape produces `TypeError: ... is not a function`, not a helpful message — check the real file, don't assume the common case.
- **Every method on the context** → note what it calls, what it does with the response (`setX`, `toastSvc.success`, merge into existing list vs replace, `finally` clearing loading), and whether a sibling method with a similar name does something subtly different (e.g. `fetchItemGroup` only calls `setItemGroup`, while `loadMoreItemGroup` calls both `setItemGroup` and `setTotalRecords` — verified in msgld-fe's `itemGroup` module). Don't assume symmetry; read each method.

### 3. Generate the spec

Follow `templates/frontend-context.spec.template.tsx`. Rules:

| Situation | Rule |
|---|---|
| Mocking `gql/query.ts` or the services/toast module | **Always use a factory mock**: `jest.mock('./gql/query', () => ({ useXQuery: jest.fn() }))`. Never bare `jest.mock('./gql/query')` (automock) — automock still loads the real module to infer its shape, and on Expo that import chain reaches `@react-native-async-storage/async-storage`, which throws `NativeModule is null` outside a real device/simulator. Factory mocks never touch the real implementation. |
| Rendering the context | `renderHook(() => use<Feature>State(), { wrapper: <Feature>ContextProvider })`. On Expo (`@testing-library/react-native` v13+) this is **async** — `await renderHook(...)`, or destructuring `result` off it comes back `undefined` and every later `result.current.x` throws `Cannot read properties of undefined (reading 'current')`. On Next.js (`@testing-library/react`) it's sync. |
| Calling a context method | Wrap in `act(async () => { await result.current.methodName(...) })` — state updates from async setState calls outside `act()` produce "not wrapped in act" warnings and can read stale state. |
| Path alias imports (`@/...`) in the spec or in files it pulls in | Jest does not read `tsconfig.json` `paths` automatically (even under `next/jest`) — add the matching entry to `jest.config.js`'s (or `package.json`'s) `moduleNameMapper`, or the import throws `Cannot find module '@/...'`. |
| Context method that just triggers a query with no response handling | One happy-path test asserting the call args is enough |
| Context method with conditional branching (e.g. merge vs replace list, only toast when `data` is truthy) | Test each branch — the "no data returned" branch is exactly where a null-check regresses silently |
| `useEffect` that auto-fetches on mount | Expect the mocked query fn to already have been called once after `renderHook` resolves; use `waitFor(() => expect(mockFn).toHaveBeenCalled())` from the same testing-library package rather than asserting synchronously |

### 4. Verify

```bash
npx jest <path-to-spec>
npx tsc --noEmit
```

### 5. Report

Same as backend: contexts covered this run, `find src/modules -name "context.tsx" | wc -l` vs `context.spec.tsx` count, and whether Jest infra was newly scaffolded (flag as a new devDependency addition).

## Frontend Common Mistakes

- **Bare `jest.mock(path)` automock on a module that (transitively) imports a native module** — works fine on Next.js (jsdom tolerates most browser-safe imports), crashes on Expo the moment the chain reaches `AsyncStorage` or any other native binding. Use factory mocks always; it's a stack-agnostic habit that costs nothing on Next.js and saves the Expo crash.
- **Forgetting `await` on `renderHook` for React Native** — silently gives you `result === undefined`, and the resulting error message ("reading 'current'") doesn't mention `renderHook` at all, making it look like a wrapper/provider problem instead of a missing `await`.
- **Assuming every `use<Feature>Query()` hook returns the same shape.** Some return a named object of trigger functions (most common), some return the raw Apollo tuple untouched. Copying the mock from one module to the next without opening `gql/query.ts` first produces confusing "not a function" errors.
- **Testing component rendering** (`render()`, `screen.getByText`, `fireEvent`) when the task is context coverage — out of scope for this skill; a heavier, separate effort with its own tradeoffs (see "Not for" above).
- **Not mocking `toastSvc`/`ToastService`** — real toast libraries can run fine under jsdom (side effect noise, not a crash) but throw under Expo/jsdom-less native-module chains; mock it every time regardless of stack, for the same reason as the gql hook.
