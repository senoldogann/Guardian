# TypeScript Tech Stack Rules

> **Selective Loading:** Load when working with TypeScript projects
> **Purpose:** TypeScript-specific best practices, patterns, and tooling

---

## Environment & Runtime

### Decision Tree

```
What are you building?
│
├── Frontend (React/Next.js)
│   └── Node 20+ (LTS), Strict Mode, React 19+
│
├── Backend API (Node)
│   └── Node 20+ (LTS), NestJS or Express with Zod validation
│
├── Backend API (Runtime-agnostic)
│   └── Hono or WinterJS compatible
│
└── CLI Tools
    └── Commander or Oclif with strict typing
```

---

## Strict Typing (Required)

### Configuration

`tsconfig.json` MUST have strict mode enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### The "No Any" Rule

**Strict Prohibition:** The `any` type is forbidden.

```typescript
// ❌ WRONG
function process(data: any) { ... }

// ✅ CORRECT: Use unknown + validation
function process(data: unknown) {
  if (isValidString(data)) {
    // data is now string
  }
}

// ✅ CORRECT: Generics
function wrap<T>(value: T): Wrapper<T> { ... }
```

---

## Project Structure

### Backend (Node/API)
```
src/
├── app/
│   ├── modules/       # Feature modules
│   ├── shared/        # Shared utilities
│   └── core/          # Core layout/config
├── main.ts            # Entry point
└── tests/             # E2E Tests
```

### Frontend (Next.js)
```
src/
├── app/               # App Router
├── components/
│   ├── ui/            # Reusable primitives (atoms)
│   └── features/      # Feature-specific components
├── lib/               # Utilities & Helpers
├── hooks/             # Custom React Hooks
└── types/             # Global Type Definitions
```

---

## Dependencies & Tooling

### Required Tools

| Tool | Purpose | Note |
|------|---------|------|
| **ESLint** | Linting | Use flat config if possible |
| **Prettier** | Formatting | Integrate with ESLint |
| **Zod** | Validation | Runtime schema validation |
| **Vitest** | Testing | Faster than Jest |

### Zod Validation Example

All external data (API responses, user input) MUST be validated at runtime.

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'USER']),
  age: z.number().min(18).optional()
});

type User = z.infer<typeof UserSchema>;

function parseUser(input: unknown): User {
  return UserSchema.parse(input); // Throws if invalid
}
```

---

## Async & Promises

### No "Fire and Forget"

Every Promise must be awaited or explicitly returned.

```typescript
// ❌ WRONG
asyncFunction(); 

// ✅ CORRECT
await asyncFunction();

// ✅ CORRECT (Background task with explicit catch)
asyncFunction().catch(logError);
```

### Async/Await Cleanliness

Avoid nested `.then()`. Use `async/await`.

```typescript
// ❌ WRONG: Callback hell
api.get().then(data => {
  db.save(data).then(res => {
    ...
  });
});

// ✅ CORRECT
const data = await api.get();
const res = await db.save(data);
```

---

## Error Handling

### Typed Exceptions

Since TypeScript doesn't have checked exceptions, use custom error classes or a Result pattern for domain errors.

```typescript
class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage
if (!user) {
  throw new AppError('USER_NOT_FOUND', 'User ID invalid');
}
```

---

## Anti-Patterns

### ❌ DON'T

```typescript
// "I know better than compiler" assertions
const user = {} as User; // ❌ Unsafe casting

// Non-null assertion
const value = map.get('key')!; // ❌ Dangerous

// Current Date in milliseconds
const time = new Date().getTime(); // ❌ Use ISO strings for transfer
```

### ✅ DO

```typescript
// Type Guards
if (isUser(obj)) { ... }

// Optional Chaining
const value = map.get('key')?.value ?? default;

// ISO Dates
const now = new Date().toISOString(); // "2024-01-01T..."
```

---

## Checklist

Before committing TypeScript code:

- [ ] `strict: true` is enabled
- [ ] No `any` types used
- [ ] No `eslint-disable` without strict justification
- [ ] Validated external data with Zod
- [ ] Handled all Promises (await/catch)
- [ ] Used Type Guards for `unknown` data
