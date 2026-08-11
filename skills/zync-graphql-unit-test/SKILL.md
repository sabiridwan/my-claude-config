---
name: zync-graphql-unit-test
description: Use when a zync-nestjs GraphQL resolver (Resolver/ResolveField/Query/Mutation) is added or changed and lacks Jest coverage, when auditing a NestJS + Apollo GraphQL backend for resolvers missing *.resolver.spec.ts, or when the user asks to "test all resolvers", "add resolver unit tests", "cover the GraphQL layer", or catch resolver-breaking changes before deploy instead of after.
---

# Zync GraphQL Unit Test

## Overview

Generates and maintains Jest unit tests for every resolver class in a **zync-nestjs** backend (NestJS 9 + Apollo GraphQL code-first + Mongoose). Closes the gap where resolver logic changes (wrong service call, dropped arg, broken field resolution) only surface after deploy because no test exercised the resolver layer.

Core principle: **one spec file per `*.resolver.ts` file, one `describe` block per exported resolver class, one test group per `@Query`/`@Mutation`/`@ResolveField` method** — mock every injected service, assert the resolver calls the right service method with the right args and returns what the service returns.

## When to Use

- Resolver file created or edited (`*.resolver.ts`) and no matching `*.resolver.spec.ts` exists, or the spec is stale relative to the resolver.
- User asks to sweep a whole project for resolver coverage ("test all resolvers", "cover graphql layer").
- Setting this up as a pre-deploy / CI gate so a broken resolver fails `npm test`, not production.

**Not for:** service/repository unit tests (different layer, different mock shape — services mock repositories, not the other way around), e2e/integration tests that hit a real DB (`test/*.e2e.ts` — separate concern), or DTO/schema validation tests.

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

## Workflow

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

## Common Mistakes

- **Skipping `.overrideGuard(GqlRolesGuard)`** on any `@ApGqlAuthorize()` resolver — `.compile()` looks like it succeeded, then every single test fails with a DI-resolution error that has nothing to do with your mocks. This is the single most common first-run failure; see the table above.
- **Assuming sibling ResolveFields share the same true/false polarity.** `EmployeeProfileResolver` has both `branchTabEnabled` (SALESMAN/SHOP_MANAGER → `false`, others → `true`) and `branches`/`branchIds` (SALESMAN/SHOP_MANAGER → real value, others → `[]`) guarded by the identical-looking `if (!this.groups.includes(employee.group)) { ... }` condition, but with opposite bodies. Trace each method's actual `if`/`return` literally — don't pattern-match on the neighboring method's expected values.
- **Mocking the whole service class** instead of only the methods called — makes tests brittle to unrelated service changes and hides which calls actually matter.
- **Testing `@ApGqlAuthorize` / `@AuditMeta` behavior** in a resolver spec — these are cross-cutting decorators, not resolver logic; test them once at the guard/interceptor level, not per resolver.
- **Asserting on GraphQL wiring** (`@Query(() => X, { name: 'y' })` metadata) — that's compile-time schema generation (`schema.gql`), already covered by `src/schema.spec.ts`-style checks. Test behavior, not decorators.
- **Skipping `ResolveField` methods** because they "just format data" — these are exactly where silent breaking changes (renamed field, null-unsafe access) slip through; they need the same coverage as `Query`/`Mutation`.
- **Real DB/network calls** in a resolver spec — if a mock is missing and a method throws `Cannot read property of undefined` on a real service call, that's a sign a provider wasn't mocked, not a reason to reach for `MongoMemoryServer`.
