# Security Guidelines

> **Document Version:** 1.0.0  
> **Purpose:** Security best practices and patterns for Maestro system

---

## Critical Security Rules

### 1. Never Expose Secrets in Code

**Forbidden Patterns:**
```python
# ❌ NEVER DO THIS
api_key = "sk-1234567890abcdef"
password = "my-secret-password"
database_url = "postgresql://user:pass@host/db"
bearer_token = "Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Required Pattern:**
```python
# ✅ ALWAYS DO THIS
import os

api_key = os.environ.get("API_KEY")
password = os.environ.get("DB_PASSWORD")
database_url = os.environ.get("DATABASE_URL")

# With validation
api_key = os.environ["API_KEY"]  # Fails fast if missing
```

---

### 2. Environment Variables Setup

**Create `.env.example` (commit this):**
```bash
# API Configuration
API_KEY=your-api-key-here
API_SECRET=your-api-secret-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
SESSION_SECRET=your-session-secret

# Third-party Services
STRIPE_SECRET_KEY=sk_test_xxx
SENDGRID_API_KEY=SG.xxx

# Security
ALLOWED_ORIGINS=http://localhost:3000,https://yourapp.com
```

**Create `.env` (NEVER commit):**
```bash
# Copy from .env.example and fill real values
cp .env.example .env
```

**Ensure `.gitignore` includes:**
```gitignore
# Environment files with secrets
.env
.env.local
.env.*.local
*.env

# Credentials
credentials.json
service-account.json
*.pem
*.key
```

---

### 3. SQL Injection Prevention

**Forbidden:**
```python
# ❌ NEVER - SQL Injection vulnerable
query = f"SELECT * FROM users WHERE id = {user_id}"
query = "SELECT * FROM users WHERE name = '" + name + "'"
```

**Required:**
```python
# ✅ Parameterized queries - ALWAYS
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
cursor.execute("SELECT * FROM users WHERE name = %s", (name,))

# SQLAlchemy
session.query(User).filter(User.id == user_id).first()

# Prisma (auto-safe)
await prisma.user.findUnique(where={"id": user_id})
```

---

### 4. Code Injection Prevention

**Forbidden:**
```python
# ❌ NEVER - Code injection
eval(user_input)
exec(user_input)
os.system(user_input)
subprocess.call(user_input, shell=True)
```

**Safe Alternatives:**
```python
# ✅ For simple literal evaluation
import ast
result = ast.literal_eval(user_input)  # Only parses literals

# ✅ For shell commands - use list, no shell=True
import subprocess
subprocess.run(["ls", "-la", directory], check=True)  # Safe

# ✅ For mathematical expressions
# Use a safe expression parser library
from simpleeval import simple_eval
result = simple_eval(expression)
```

---

### 5. XSS Prevention

**Forbidden:**
```jsx
// ❌ NEVER - XSS vulnerable
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ❌ NEVER in templates
{{ userInput | safe }}
```

**Required:**
```jsx
// ✅ React auto-escapes by default
<div>{userContent}</div>

// ✅ If HTML needed, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

---

### 6. Secure Token Storage

**Forbidden:**
```javascript
// ❌ NEVER - Tokens accessible to scripts
localStorage.setItem('auth_token', token);
document.cookie = `token=${token}`;  // Without flags
```

**Required:**
```javascript
// ✅ HTTP-only cookies (set by server)
// Server-side:
res.cookie('auth_token', token, {
  httpOnly: true,   // Not accessible to JavaScript
  secure: true,     // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 3600000   // 1 hour
});

// ✅ For mobile - use secure storage
// React Native
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('token', token);

// iOS - Keychain
// Android - EncryptedSharedPreferences
```

---

### 7. Input Validation

**Always validate at boundaries:**

```python
from pydantic import BaseModel, Field, validator
import re

class UserInput(BaseModel):
    email: str = Field(..., max_length=255)
    name: str = Field(..., min_length=2, max_length=100)
    age: int = Field(..., ge=0, le=150)
    
    @validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
            raise ValueError('Invalid email format')
        return v.lower()
    
    @validator('name')
    def validate_name(cls, v):
        # Remove potentially dangerous characters
        return re.sub(r'[<>&"\']', '', v)
```

---

### 8. Security Headers

**Required headers for web applications:**

```python
# FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourapp.com"],  # Not "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

---

### 9. Logging Security

**Forbidden:**
```python
# ❌ NEVER log sensitive data
logger.info(f"User login: {username}, password: {password}")
logger.debug(f"API call with token: {api_token}")
logger.info(f"Credit card: {card_number}")
```

**Required:**
```python
# ✅ Mask or omit sensitive data
logger.info(f"User login: {username}")
logger.debug(f"API call with token: {token[:8]}...")
logger.info(f"Payment processed for card ending in {card_number[-4:]}")

# ✅ Use structured logging
import structlog
logger = structlog.get_logger()
logger.info("user_login", user_id=user.id)  # Don't log PII
```

---

### 10. Dependency Security

**Regular security audits:**

```bash
# Python
pip install pip-audit
pip-audit

# Node.js
npm audit
npm audit fix

# Go
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...

# Rust
cargo install cargo-audit
cargo audit
```

**Dependabot/Renovate configuration:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## Security Checklist

### Before Commit
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] No SQL string concatenation
- [ ] No eval/exec with user input
- [ ] Input validated with strict schemas
- [ ] Sensitive data not logged

### Before Deployment
- [ ] `.env` not in repository
- [ ] `.env.example` provided
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Dependencies audited

### Periodic Review
- [ ] Run `npm audit` / `pip-audit` weekly
- [ ] Update dependencies monthly
- [ ] Review access tokens quarterly
- [ ] Rotate secrets annually

---

## Incident Response

If secrets are exposed:

1. **Immediately revoke** the exposed credentials
2. **Generate new** credentials
3. **Update** all systems using those credentials
4. **Audit** git history for exposure
5. **Review** logs for unauthorized access
6. **Document** the incident

```bash
# Remove secret from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/secret-file" \
  --prune-empty --tag-name-filter cat -- --all
  
# Force push (CAUTION: coordinate with team)
git push origin --force --all
```

---

## Approved Security Tools

| Category | Tool | Purpose |
|----------|------|---------|
| Secrets scanning | `gitleaks` | Pre-commit secret detection |
| Dependency audit | `npm audit`, `pip-audit` | Vulnerability scanning |
| SAST | `semgrep`, `bandit` | Static code analysis |
| Container scanning | `trivy`, `docker scout` | Image vulnerabilities |
| API security | `OWASP ZAP` | Dynamic testing |

---

## Contact

For security concerns or incident reporting:
- Review security scan results in `scan_results.json`
- Check security rules in `.agent/rules/50-security-and-testing.md`
- Use security-review skill for guidance
