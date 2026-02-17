# Swift Tech Stack Rules

> **Selective Loading:** Load when working with Swift/iOS/macOS projects
> **Purpose:** Swift-specific best practices, patterns, and tooling

---

## Environment & Runtime

### Decision Tree

```
What are you building?
│
├── iOS / iPadOS / macOS App (Modern)
│   └── SwiftUI + MVVM + Swift Concurrency
│
├── System / Framework / Low-level
│   └── Swift 6+ (Strict Concurrency Checking)
│
├── Server-side Swift
│   └── Vapor
│
└── Scripting / CLI
│   └── Swift Argument Parser
```

---

## Memory Management & Safety

### The "No Force Unwrap" Rule

**Strict Prohibition:** The force unwrap operator `!` is forbidden in production code (except for IBOutlets or trivial XCTest setups).

```swift
// ❌ WRONG
let url = URL(string: "https://api.example.com")!
let value = dict["key"]!

// ✅ CORRECT: Optional Binding
if let url = URL(string: "https://api.example.com") { ... }

// ✅ CORRECT: Guard Statement
guard let value = dict["key"] else { return }

// ✅ CORRECT: Default Value
let value = dict["key"] ?? "default"
```

### Memory Leaks (Capture Lists)

Always handle reference cycles in closures.

```swift
// ❌ WRONG: Strong reference to self
network.fetch { result in
    self.updateUI(result)
}

// ✅ CORRECT: Weak self
network.fetch { [weak self] result in
    guard let self = self else { return }
    self.updateUI(result)
}
```

---

## Concurrency (Swift 6+)

### Async/Await Over GCD

Grand Central Dispatch (GCD) patterns (`DispatchQueue.main.async`) are deprecated for business logic. Use structured concurrency.

```swift
// ❌ WRONG (Legacy)
func fetchData(completion: @escaping (Result<Data, Error>) -> Void) {
    DispatchQueue.global().async {
        // ...
        DispatchQueue.main.async { completion(.success(data)) }
    }
}

// ✅ CORRECT (Modern)
func fetchData() async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}

// Updating UI
@MainActor
func updateView() {
    self.data = data
}
```

### Actors for State

Use `actor` to prevent data races in shared mutable state.

```swift
// ✅ CORRECT
actor DataManager {
    var cache: [String: Data] = [:]
    
    func save(_ data: Data, for key: String) {
        cache[key] = data
    }
}
```

---

## Project Structure (MVVM)

### Recommended Folders

```
App/
├── App.swift              # @main
├── Features/              # Feature-based organization
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   ├── DashboardViewModel.swift
│   │   └── Components/
│   └── Settings/
├── Core/
│   ├── Network/           # API Clients
│   ├── Models/            # Global Data Models
│   ├── Extensions/        # Swift Extensions
│   └── Storage/           # Persistence (SwiftData/CoreData)
└── Resources/
    ├── Assets.xcassets
    └── Preview Content/
```

---

## Dependencies & Tooling

### Package Management

**Strict Rule:** Use **Swift Package Manager (SPM)** exclusively.
*   🚫 CocoaPods: Forbidden.
*   🚫 Carthage: Forbidden.
*   ✅ SPM: Local and remote dependencies.

### Key Libraries (Standard Stack)

| Category | Library | Note |
|----------|---------|------|
| **Linting** | SwiftLint | Mandatory build phase |
| **Networking** | Foundation (URLSession) | Or helper libraries like Alamofire only if complex |
| **Architecture** | ComposableArchitecture (TCA) | Optional, for complex state |
| **Testing** | XCTest / Swift Testing | Native testing framework |

---

## SwiftUI Best Practices

### State Management

*   Use `@State` for view-local private state.
*   Use `@StateObject` (ownership) vs `@ObservedObject` (monitoring) correctly.
*   Use `@EnvironmentObject` sparingly for global state.

```swift
struct UserView: View {
    @StateObject private var viewModel = UserViewModel() // ✅ Owns the lifecycle
    
    var body: some View {
        ...
    }
}
```

### View Body Cleanliness

Keep `var body: some View` clean. Extract logic to ViewModel or computed properties.

```swift
// ❌ WRONG
var body: some View {
    Button(action: {
        // ... 50 lines of logic ...
    }) { Text("Go") }
}

// ✅ CORRECT
var body: some View {
    Button(action: viewModel.handlePress) {
        Text("Go")
    }
}
```

---

## Checklist

Before committing Swift code:

- [ ] SwiftLint passes with 0 errors
- [ ] No Force Unwraps (`!`)
- [ ] UI logic is in ViewModels (or Stores)
- [ ] Async/Await is used (No legacy closures)
- [ ] `[weak self]` is used in closures where needed
- [ ] SwiftUI Previews are working
