# guardian-rules

Deterministic, regex-based rule engine for Guardian. Complements AI-powered
analysis with fast, predictable pattern matching.

## Features

- **`Rule`** — a single check backed by a compiled regex, with severity,
  message, optional auto-fix suggestion, and file-pattern filters.
- **`RuleSet`** — a named collection of rules; serializable to/from YAML and
  JSON for easy sharing.
- **`RuleEngine`** — evaluates file content against loaded rule sets and returns
  a sorted list of `RuleViolation`s.
- **Built-in defaults** — ships with rules for hardcoded secrets, unlinked
  TODO/FIXME comments, `console.log` in JS/TS, and undocumented `unsafe` blocks
  in Rust.

## Quick start

```rust
use guardian_rules::{RuleEngine, Severity, Rule};

// Use the built-in defaults
let engine = RuleEngine::with_defaults();
let violations = engine.evaluate("app.js", "console.log('oops');\n");
assert_eq!(violations[0].rule_id, "no-console-log");

// Add a custom rule
let mut engine = RuleEngine::with_defaults();
engine.add_rule(
    Rule::new("no-dbg", "No dbg! macro", Severity::Warning,
              r"\bdbg!\s*\(", "Remove dbg! before committing").unwrap(),
);
```

## Loading rules from files

```rust
use guardian_rules::RuleSet;

let yaml = std::fs::read_to_string("my-rules.yaml").unwrap();
let set = RuleSet::from_yaml(&yaml).unwrap();
```

## Default rules

| ID | Severity | Description |
|----|----------|-------------|
| `no-hardcoded-secrets` | error | Detects passwords, API keys, tokens assigned to string literals |
| `todo-needs-issue` | warning | Flags TODO/FIXME without an issue reference (`#123` or `PROJ-456`) |
| `no-console-log` | warning | Catches `console.log/debug/info` in `.js/.ts/.jsx/.tsx` files |
| `unsafe-needs-safety-comment` | error | Requires a `// SAFETY:` comment before `unsafe {` blocks in Rust |

## Extensibility

Create a `Rule` programmatically or define rule sets in YAML/JSON. Rules support:

- **File-pattern filters** — restrict rules to specific file extensions.
- **Auto-fix suggestions** — attach a human-readable fix hint.
- **Enable/disable** — toggle rules without removing them.

## License

Same as the Guardian project (see root LICENSE).
