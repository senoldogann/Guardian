# Go Tech Stack Rules

> **Selective Loading:** Load when working with Go projects
> **Purpose:** Go-specific best practices, patterns, and tooling

---

## Project Structure

### Standard Layout

```
project/
├── cmd/
│   └── myapp/
│       └── main.go          # Entry point
├── internal/                 # Private packages
│   ├── handlers/
│   ├── services/
│   └── repository/
├── pkg/                      # Public packages (optional)
├── api/                      # OpenAPI specs, protobuf
├── configs/
├── scripts/
├── go.mod
├── go.sum
└── Makefile
```

### Package Guidelines

```go
// Package names: short, lowercase, no underscores
package user  // ✅
package user_service  // ❌

// Import grouping
import (
    // Standard library
    "context"
    "fmt"
    
    // Third-party
    "github.com/gin-gonic/gin"
    
    // Internal
    "myapp/internal/services"
)
```

---

## Framework Selection

### Decision Tree

```
What are you building?
│
├── REST API (simple)
│   └── net/http + chi or gorilla/mux
│
├── REST API (full-featured)
│   └── Gin or Echo (middleware, validation)
│
├── gRPC Services
│   └── grpc-go + protobuf
│
├── CLI Tool
│   └── cobra + viper
│
├── Background Workers
│   └── temporal.io or go-workers
│
└── Microservices
    └── go-kit or go-micro
```

---

## Error Handling

### Error Wrapping (Required)

```go
import "fmt"

// Always wrap errors with context
func GetUser(id int) (*User, error) {
    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("GetUser(%d): %w", id, err)
    }
    return user, nil
}

// Custom error types
type NotFoundError struct {
    Resource string
    ID       int
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("%s with ID %d not found", e.Resource, e.ID)
}

// Error checking
if errors.Is(err, sql.ErrNoRows) {
    return &NotFoundError{Resource: "user", ID: id}
}
```

### Don't Ignore Errors

```go
// ❌ NEVER
_ = file.Close()

// ✅ Handle or defer with error check
defer func() {
    if err := file.Close(); err != nil {
        log.Printf("failed to close file: %v", err)
    }
}()
```

---

## Concurrency

### Goroutines & Channels

```go
// Always use context for cancellation
func FetchData(ctx context.Context, urls []string) ([]Result, error) {
    results := make(chan Result, len(urls))
    errs := make(chan error, len(urls))
    
    for _, url := range urls {
        go func(u string) {
            select {
            case <-ctx.Done():
                errs <- ctx.Err()
                return
            default:
                result, err := fetch(u)
                if err != nil {
                    errs <- err
                    return
                }
                results <- result
            }
        }(url)
    }
    
    // Collect results...
}
```

### Sync Patterns

```go
import "sync"

// WaitGroup for multiple goroutines
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func(i Item) {
        defer wg.Done()
        process(i)
    }(item)
}
wg.Wait()

// Mutex for shared state
type SafeCounter struct {
    mu    sync.RWMutex
    count int
}

func (c *SafeCounter) Inc() {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.count++
}

func (c *SafeCounter) Get() int {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.count
}
```

---

## Interface Design

### Small Interfaces (Required)

```go
// ✅ Small, focused interfaces
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

// Compose when needed
type ReadWriter interface {
    Reader
    Writer
}

// ❌ Avoid large interfaces
type UserService interface {
    CreateUser(...)
    GetUser(...)
    UpdateUser(...)
    DeleteUser(...)
    ListUsers(...)
    // ... 10 more methods
}
```

### Accept Interfaces, Return Structs

```go
// ✅ Accept interface
func ProcessData(r io.Reader) error {
    // Works with any Reader
}

// ✅ Return concrete type
func NewUserService(db *sql.DB) *UserService {
    return &UserService{db: db}
}
```

---

## Testing

### Table-Driven Tests (Required)

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 0, 0},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", 
                    tt.a, tt.b, result, tt.expected)
            }
        })
    }
}
```

### Mocking with Interfaces

```go
// Define interface for dependency
type UserRepository interface {
    FindByID(id int) (*User, error)
}

// Mock implementation for tests
type MockUserRepo struct {
    users map[int]*User
}

func (m *MockUserRepo) FindByID(id int) (*User, error) {
    if user, ok := m.users[id]; ok {
        return user, nil
    }
    return nil, ErrNotFound
}
```

---

## Performance

### Memory Management

```go
// Pre-allocate slices when size is known
items := make([]Item, 0, expectedSize)

// Reuse buffers
var buf bytes.Buffer
buf.Reset()

// Use sync.Pool for frequently allocated objects
var bufPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

buf := bufPool.Get().(*bytes.Buffer)
defer bufPool.Put(buf)
```

### Avoid Common Pitfalls

```go
// ❌ String concatenation in loop
var result string
for _, s := range strs {
    result += s  // O(n²)
}

// ✅ Use strings.Builder
var sb strings.Builder
for _, s := range strs {
    sb.WriteString(s)
}
result := sb.String()

// ❌ Range loop variable capture
for _, item := range items {
    go func() {
        process(item)  // Bug: captures loop variable
    }()
}

// ✅ Pass as parameter
for _, item := range items {
    go func(i Item) {
        process(i)
    }(item)
}
```

---

## Tooling

### Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **golangci-lint** | Linting | `go install github.com/golangci-lint/golangci-lint/cmd/golangci-lint@latest` |
| **gofumpt** | Formatting | `go install mvdan.cc/gofumpt@latest` |
| **govulncheck** | Security | `go install golang.org/x/vuln/cmd/govulncheck@latest` |

### .golangci.yml Template

```yaml
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gofumpt
    - misspell
    - unconvert
    - unparam

linters-settings:
  errcheck:
    check-type-assertions: true
  govet:
    check-shadowing: true

issues:
  max-same-issues: 0
```

---

## Anti-Patterns

### ❌ DON'T

```go
// Panic in library code
func ParseConfig(path string) Config {
    data, err := os.ReadFile(path)
    if err != nil {
        panic(err)  // ❌ Return error instead
    }
}

// Naked returns with many variables
func process() (result int, err error) {
    // ... many lines
    return  // ❌ Confusing
}

// init() for complex logic
func init() {
    db, _ = sql.Open(...)  // ❌ Hard to test, ignores error
}

// Empty interface without need
func Process(data interface{}) {  // ❌ Use generics or specific type
}
```

---

## Checklist

Before committing Go code:

- [ ] `go fmt` / `gofumpt` applied
- [ ] `golangci-lint run` passes
- [ ] `go vet` passes
- [ ] All errors handled (no `_` for errors)
- [ ] Context passed to long-running operations
- [ ] Interfaces are small and focused
- [ ] Table-driven tests for functions
- [ ] No goroutine leaks (proper cancellation)
