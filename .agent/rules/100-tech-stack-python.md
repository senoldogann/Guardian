# Python Tech Stack Rules

> **Selective Loading:** Load when working with Python projects
> **Purpose:** Python-specific best practices, patterns, and tooling

---

## Framework Selection

### Decision Tree

```
What are you building?
│
├── API-first / Microservices
│   └── FastAPI (async, modern, Pydantic validation)
│
├── Full-stack Web / CMS / Admin
│   └── Django (batteries-included, ORM, admin)
│
├── Simple / Script / Learning
│   └── Flask (minimal, flexible)
│
├── AI/ML API Serving
│   └── FastAPI + uvicorn (async, JSON Schema)
│
├── Background Workers
│   └── Celery + Redis (distributed tasks)
│
└── CLI Tools
    └── Typer or Click (type-safe CLI)
```

---

## Async vs Sync

### When to Use Async

```python
# async def is better when:
# - I/O-bound operations (database, HTTP, file)
# - Many concurrent connections
# - Real-time features (WebSocket)
# - Microservices communication

async def fetch_user(user_id: int) -> User:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/users/{user_id}")
        return User(**response.json())
```

### When to Use Sync

```python
# def (sync) is better when:
# - CPU-bound operations
# - Simple scripts
# - Legacy codebase
# - Blocking libraries without async version

def calculate_report(data: List[Dict]) -> Report:
    # CPU-intensive computation
    return process_data(data)
```

### Golden Rule

```
I/O-bound → async (waiting for external)
CPU-bound → sync + multiprocessing (computing)

DON'T:
├── Mix sync and async carelessly
├── Use sync libraries in async code (blocks event loop)
└── Force async for CPU work
```

---

## Type Hints (Required)

### Always Type

```python
from typing import Optional, List, Dict, Callable

# Function parameters and return types
def find_user(user_id: int) -> Optional[User]:
    ...

# Class attributes
class Config:
    api_url: str
    timeout: int = 30

# Generic collections
def get_items() -> List[Item]:
    ...
```

### Pydantic for Validation

```python
from pydantic import BaseModel, Field, validator

class UserCreate(BaseModel):
    email: str = Field(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=0, le=150)
    
    @validator('email')
    def lowercase_email(cls, v: str) -> str:
        return v.lower()
```

---

## Project Structure

### Small Project
```
project/
├── main.py
├── utils.py
├── requirements.txt
└── tests/
    └── test_main.py
```

### Medium API (FastAPI)
```
project/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── dependencies.py
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── schemas/
├── tests/
├── pyproject.toml
└── Dockerfile
```

### Large Application
```
project/
├── src/
│   └── myapp/
│       ├── core/
│       ├── api/
│       ├── services/
│       ├── models/
│       └── infrastructure/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── pyproject.toml
└── docker-compose.yml
```

---

## Dependencies & Tooling

### Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| **ruff** | Linting + formatting (fast) | `pip install ruff` |
| **mypy** | Type checking | `pip install mypy` |
| **pytest** | Testing | `pip install pytest pytest-cov` |
| **pre-commit** | Git hooks | `pip install pre-commit` |

### pyproject.toml Template

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.11"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "C4", "SIM"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --cov=src --cov-report=term-missing"
```

---

## Error Handling

### Result Pattern

```python
from typing import TypeVar, Generic, Union
from dataclasses import dataclass

T = TypeVar('T')
E = TypeVar('E')

@dataclass
class Ok(Generic[T]):
    value: T

@dataclass
class Err(Generic[E]):
    error: E

Result = Union[Ok[T], Err[E]]

def divide(a: int, b: int) -> Result[float, str]:
    if b == 0:
        return Err("Division by zero")
    return Ok(a / b)
```

### Exception Handling

```python
# DO: Specific exceptions with context
class UserNotFoundError(Exception):
    def __init__(self, user_id: int):
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")

# DON'T: Bare except
try:
    user = get_user(id)
except:  # ❌ NEVER
    pass

# DO: Specific handling
try:
    user = get_user(id)
except UserNotFoundError as e:
    logger.warning(f"User not found: {e.user_id}")
    raise HTTPException(status_code=404, detail=str(e))
```

---

## Testing

### Test Structure (AAA Pattern)

```python
import pytest
from myapp.services import UserService

class TestUserService:
    def test_create_user_success(self):
        # Arrange
        service = UserService()
        user_data = {"email": "test@example.com", "name": "Test"}
        
        # Act
        result = service.create_user(user_data)
        
        # Assert
        assert result.email == "test@example.com"
        assert result.id is not None

    @pytest.fixture
    def user_service(self):
        return UserService(db=MockDB())
```

### Async Testing

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_user():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/users/1")
        assert response.status_code == 200
```

---

## Anti-Patterns

### ❌ DON'T

```python
# Mutable default argument
def add_item(item, items=[]):  # ❌
    items.append(item)
    return items

# Use instead:
def add_item(item, items=None):  # ✅
    if items is None:
        items = []
    items.append(item)
    return items

# Star import
from module import *  # ❌

# Bare except
except:  # ❌
    pass

# String concatenation in loops
result = ""
for item in items:
    result += str(item)  # ❌ O(n²)

# Use instead:
result = "".join(str(item) for item in items)  # ✅ O(n)
```

---

## Performance Tips

1. **Use generators for large data**
   ```python
   def read_large_file(path: str):
       with open(path) as f:
           for line in f:
               yield line.strip()
   ```

2. **Use `__slots__` for memory-critical classes**
   ```python
   class Point:
       __slots__ = ['x', 'y']
       def __init__(self, x: float, y: float):
           self.x = x
           self.y = y
   ```

3. **Use `functools.lru_cache` for expensive computations**
   ```python
   from functools import lru_cache
   
   @lru_cache(maxsize=128)
   def fibonacci(n: int) -> int:
       if n < 2:
           return n
       return fibonacci(n-1) + fibonacci(n-2)
   ```

---

## Checklist

Before committing Python code:

- [ ] Type hints on all functions
- [ ] ruff check passes
- [ ] mypy check passes
- [ ] pytest with >80% coverage
- [ ] No bare except clauses
- [ ] No mutable default arguments
- [ ] Docstrings on public functions
