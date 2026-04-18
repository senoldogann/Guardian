# GitHub Token Security Policy

## Overview

This document outlines the security policies and procedures for managing GitHub API tokens used in the Guardian project. Token security is critical to prevent unauthorized access and ensure system integrity.

---

## Token Rotation Policy

### Rotation Schedule
- **Primary Tokens:** Rotated every 90 days
- **Emergency Tokens:** Rotated immediately after use
- **Backup Tokens:** Rotated every 30 days

### Rotation Process

1. **Pre-Rotation (Day -7)**
   - Generate new token with identical permissions
   - Test new token in staging environment
   - Update token in secure storage

2. **Rotation Day (Day 0)**
   - Update `GITHUB_PUBLIC_READ_TOKEN` environment variable
   - Restart application to load new token
   - Monitor for 24 hours

3. **Post-Rotation (Day +1 to +7)**
   - Verify all systems operational
   - Revoke old token
   - Document rotation in audit log

### Emergency Rotation
Immediate rotation required when:
- Token suspected of compromise
- Team member with token access leaves
- Security incident detected
- GitHub security advisory affects tokens

---

## Token Scope & Permissions

### Minimum Required Permissions (Principle of Least Privilege)

**GITHUB_PUBLIC_READ_TOKEN:**
- `public_repo` - Read access to public repositories
- No write permissions
- No admin permissions
- No user data access

### Forbidden Permissions
Never grant these permissions:
- `repo` (Full repository access)
- `repo:status` (Commit status write)
- `repo_deployment` (Deployment status write)
- `repo:invite` (Repository invitations)
- `repo:admin` (Repository admin access)
- `workflow` (GitHub Actions workflow)
- `write:packages` (Package write access)
- `delete:packages` (Package delete access)
- `admin:org` (Organization admin)
- `admin:public_key` (Public key admin)
- `admin:repo_hook` (Repository hook admin)
- `admin:org_hook` (Organization hook admin)
- `admin:ssh_signing_key` (SSH signing key admin)
- `user` (User profile access)
- `project` (Project board access)
- `admin:gpg_key` (GPG key admin)

---

## Token Storage & Handling

### Environment Variables
- Store tokens ONLY in environment variables
- Never commit tokens to git repositories
- Use `.env.example` without real values
- Document required variables in README

### Secure Storage Requirements
- Production: Use secret management service (Vercel, GitHub Secrets)
- Development: Use local `.env` file (gitignored)
- CI/CD: Use repository secrets
- Never log or print tokens

### Token Masking
All tokens must be masked in:
- Logs
- Error messages
- API responses
- UI displays
- Debug output

Masking format: `ghp_****XXXX` (show first 4, last 4 chars)

---

## Audit Logging

### Required Audit Events

1. **Token Usage**
   - Timestamp
   - Endpoint accessed
   - Rate limit remaining
   - Success/failure status

2. **Token Rotation**
   - Rotation date
   - Reason for rotation
   - Old token fingerprint (hash)
   - New token fingerprint (hash)
   - Performed by

3. **Token Validation Failures**
   - Failure timestamp
   - Failure reason
   - Source IP (if applicable)
   - Attempted endpoint

### Audit Log Retention
- Production: 90 days
- Development: 30 days
- Archive: 1 year (encrypted)

---

## Token Validation

### Pre-Flight Checks

Every token usage must validate:

1. **Format Validation**
   - Prefix check (`ghp_`, `github_pat_`)
   - Length check (40+ chars for classic, 93+ for fine-grained)
   - Character set (alphanumeric only after prefix)

2. **Permission Validation**
   - Verify minimal required permissions
   - Check for forbidden permissions
   - Log permission scope

3. **Expiration Check**
   - Verify token not expired
   - Check rotation due date
   - Alert if rotation overdue

### Validation Results

- **Valid:** Proceed with request
- **Invalid:** Log security event, reject request
- **Expiring Soon:** Log warning, schedule rotation

---

## Incident Response

### Token Compromise Detection

Indicators of compromise:
- Unusual API call patterns
- Rate limit exceeded unexpectedly
- Failed authentication attempts
- Access from unexpected IPs
- Token used outside business hours

### Response Procedure

1. **Immediate (0-15 minutes)**
   - Revoke compromised token
   - Activate emergency token
   - Alert security team

2. **Short-term (15 minutes - 2 hours)**
   - Audit all recent API calls
   - Check for unauthorized access
   - Generate new primary token

3. **Long-term (2-24 hours)**
   - Full security audit
   - Update rotation schedule
   - Document incident
   - Implement additional monitoring

---

## Compliance

### Standards
- OWASP ASVS 4.0 - Authentication Verification Requirements
- NIST SP 800-63B - Digital Identity Guidelines
- ISO 27001 - Access Control Policy

### Review Schedule
- Policy review: Quarterly
- Token audit: Monthly
- Permission review: Bi-annually
- Penetration testing: Annually

---

## Contact

For token security issues or rotation assistance:
- Email: contact@senoldogan.dev
- GitHub Security: https://github.com/senoldogann/Guardian/security

---

**Last Updated:** 2026-04-19  
**Version:** 1.3.0  
**Next Review:** 2026-07-19
