# Rust Tech Stack Rules

> **Selective Loading:** Load when working with Rust projects
> **Purpose:** Rust-specific best practices, patterns, and tooling

---

## Project Structure

### Standard Layout

```
project/
├── src/
│   ├── main.rs           # Binary entry
│   ├── lib.rs            # Library entry
│   ├── models/
│   │   └── mod.rs
│   ├── services/
│   │   └── mod.rs
│   └── handlers/
│       └── mod.rs
├── tests/                # Integration tests
│   └── integration.rs
├── benches/              # Benchmarks
├── examples/
├── Cargo.toml
├── Cargo.lock
└── rust-toolchain.toml
```

### Module Organization

```rust
// src/lib.rs
pub mod models;
pub mod services;
pub mod handlers;
pub mod error;

// Re-exports for convenience
pub use error::{Error, Result};
```

---

## Framework Selection

### Decision Tree

```
What are you building?
│
├── REST API
│   └── axum or actix-web
│
├── CLI Tool
│   └── clap (derive) + tokio
│
├── WebAssembly
│   └── wasm-bindgen + web-sys
│
├── Systems Programming
│   └── std + specific crates
│
├── Async Runtime
│   └── tokio (default) or async-std
│
└── Database
    └── sqlx (compile-time checked) or diesel
```

---

## Error Handling

### Custom Error Types (Required)

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("User not found: {0}")]
    UserNotFound(i64),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Validation failed: {0}")]
    Validation(String),
    
    #[error("Unauthorized")]
    Unauthorized,
}

// Result type alias
pub type Result<T> = std::result::Result<T, AppError>;
```

### Error Propagation

```rust
// Use ? operator with context
use anyhow::Context;

fn load_config(path: &str) -> anyhow::Result<Config> {
    let content = std::fs::read_to_string(path)
        .context(format!("Failed to read config from {}", path))?;
    
    let config: Config = toml::from_str(&content)
        .context("Failed to parse config")?;
    
    Ok(config)
}
```

---

## Ownership & Borrowing

### Key Principles

```rust
// Prefer borrowing over ownership when possible
fn process(data: &str) -> Result<()> {  // ✅ Borrows
    // ...
}

fn process(data: String) -> Result<()> {  // ❌ Takes ownership unnecessarily
    // ...
}

// Use Cow for flexibility
use std::borrow::Cow;

fn process<'a>(data: Cow<'a, str>) -> Cow<'a, str> {
    if needs_modification(&data) {
        Cow::Owned(modify(data.into_owned()))
    } else {
        data
    }
}
```

### Lifetime Annotations

```rust
// Explicit when needed, elide when possible
struct Parser<'a> {
    input: &'a str,
    position: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, position: 0 }
    }
    
    // Lifetime elision works here
    fn peek(&self) -> Option<char> {
        self.input.chars().nth(self.position)
    }
}
```

---

## Async Patterns

### Tokio Runtime

```rust
use tokio;

#[tokio::main]
async fn main() -> Result<()> {
    let server = start_server().await?;
    server.await
}

// Spawn tasks properly
async fn process_items(items: Vec<Item>) -> Result<Vec<Output>> {
    let handles: Vec<_> = items
        .into_iter()
        .map(|item| tokio::spawn(async move {
            process_item(item).await
        }))
        .collect();
    
    let results = futures::future::try_join_all(handles).await?;
    Ok(results.into_iter().collect::<Result<Vec<_>>>()?)
}
```

### Cancellation

```rust
use tokio::select;
use tokio_util::sync::CancellationToken;

async fn worker(cancel: CancellationToken) {
    loop {
        select! {
            _ = cancel.cancelled() => {
                println!("Worker cancelled");
                return;
            }
            _ = do_work() => {
                // Continue working
            }
        }
    }
}
```

---

## Traits & Generics

### Trait Design

```rust
// Small, focused traits
pub trait Serialize {
    fn serialize(&self) -> Vec<u8>;
}

pub trait Deserialize: Sized {
    fn deserialize(data: &[u8]) -> Result<Self>;
}

// Extension traits for additional functionality
pub trait SerializeExt: Serialize {
    fn serialize_to_file(&self, path: &str) -> std::io::Result<()> {
        std::fs::write(path, self.serialize())
    }
}

// Blanket implementation
impl<T: Serialize> SerializeExt for T {}
```

### Generic Constraints

```rust
// Prefer impl Trait for function arguments
fn process(items: impl Iterator<Item = u32>) -> u32 {
    items.sum()
}

// Use where clauses for complex bounds
fn complex<T, U>(t: T, u: U) -> String
where
    T: Display + Debug,
    U: AsRef<str>,
{
    format!("{}: {}", t, u.as_ref())
}
```

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_valid_input() {
        let result = parse("valid");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Expected);
    }
    
    #[test]
    fn test_parse_invalid_input() {
        let result = parse("invalid");
        assert!(matches!(result, Err(ParseError::Invalid(_))));
    }
    
    #[tokio::test]
    async fn test_async_operation() {
        let result = async_operation().await;
        assert!(result.is_ok());
    }
}
```

### Property-Based Testing

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_encode_decode_roundtrip(s in ".*") {
        let encoded = encode(&s);
        let decoded = decode(&encoded).unwrap();
        prop_assert_eq!(s, decoded);
    }
}
```

---

## Performance

### Zero-Cost Abstractions

```rust
// Iterator chains compile to efficient loops
let sum: u32 = items
    .iter()
    .filter(|x| x.is_valid())
    .map(|x| x.value)
    .sum();

// Use collect with type annotations
let valid: Vec<_> = items.into_iter()
    .filter(|x| x.is_valid())
    .collect();
```

### Avoiding Allocations

```rust
// Use references and slices
fn process(data: &[u8]) -> &str {
    // No allocation
    std::str::from_utf8(data).unwrap()
}

// Use SmallVec for small collections
use smallvec::SmallVec;
type SmallItems = SmallVec<[Item; 8]>;  // Stack-allocated up to 8

// Use arrayvec for fixed-size
use arrayvec::ArrayVec;
let mut items: ArrayVec<Item, 16> = ArrayVec::new();
```

---

## Tooling

### Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **clippy** | Linting | Built-in: `cargo clippy` |
| **rustfmt** | Formatting | Built-in: `cargo fmt` |
| **cargo-audit** | Security | `cargo install cargo-audit` |
| **cargo-deny** | License/deps | `cargo install cargo-deny` |
| **miri** | UB detection | `rustup +nightly component add miri` |

### Cargo.toml Template

```toml
[package]
name = "myapp"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
thiserror = "1"
anyhow = "1"
tracing = "0.1"

[dev-dependencies]
proptest = "1"
tokio-test = "0.4"

[profile.release]
lto = true
codegen-units = 1

[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
all = "warn"
pedantic = "warn"
```

---

## Anti-Patterns

### ❌ DON'T

```rust
// Unnecessary clone
let data = expensive_data.clone();  // ❌ Consider borrowing
process(&expensive_data);  // ✅

// Unwrap in library code
let value = result.unwrap();  // ❌ In libraries
let value = result?;  // ✅ Propagate error

// String concatenation
let s = s1 + &s2 + &s3;  // ❌ Multiple allocations
let s = format!("{}{}{}", s1, s2, s3);  // ✅ Single allocation

// Box<dyn Error> in public API
fn process() -> Result<(), Box<dyn Error>>;  // ❌ Not ergonomic
fn process() -> Result<(), AppError>;  // ✅ Custom error type

// Mutex<Vec<T>> for read-heavy workloads
let data: Mutex<Vec<T>>;  // ❌ Blocks readers
let data: RwLock<Vec<T>>;  // ✅ Allows concurrent reads
```

---

## Checklist

Before committing Rust code:

- [ ] `cargo fmt` applied
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo test` passes
- [ ] `cargo doc` builds without warnings
- [ ] No `unwrap()` or `expect()` in library code
- [ ] Custom error types with `thiserror`
- [ ] Proper lifetime annotations where needed
- [ ] No unnecessary `.clone()` calls
- [ ] `#[must_use]` on functions returning values that shouldn't be ignored
