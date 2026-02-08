# 100-TECH-STACK-TYPESCRIPT

## 1. COMPILER OPTIONS
*   `strict: true` is MANDATORY.
*   `noImplicitAny: true` is MANDATORY.

## 2. TYPE DEFINITIONS
*   **Props:** Use `interface` for component props.
    ```typescript
    interface ButtonProps {
      variant: 'primary' | 'secondary';
      label: string;
    }
    ```
*   **Export:** Export types/interfaces with the component.

## 3. BEST PRACTICES
*   **Avoid Enums:** Use string unions (`'a' | 'b'`) or const objects (`as const`).
*   **Utility Types:** Use `Pick`, `Omit`, `Partial` to avoid duplication.
*   **Async:** Always type the return value of async functions (e.g., `Promise<User>`).
