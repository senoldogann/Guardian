# Workflows Disabled (Local Release Mode)

This repository is operating in **Local Release Mode** to avoid consuming GitHub Actions minutes.

All CI/release workflows have been moved out of `.github/workflows/` so GitHub Actions will not
auto-run on push/PR/tag.

If/when we re-enable Actions:
- Move workflow files back into `.github/workflows/`
- Review secrets/variables requirements
- Verify billing/spending limits are configured

