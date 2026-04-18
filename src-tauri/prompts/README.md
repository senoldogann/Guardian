# Guardian Prompt Templates

These are the system prompt templates used by Guardian's AI analysis engine.

## Files
- `batch_system.md` — Multi-file batch analysis prompt (primary audit path)
- `single_system.md` — Single file diff analysis prompt
- `guru_system.md` — Guardian Guru interactive chat prompt

## Template Variables
- `{{LANGUAGE_BLOCK}}` — Language instruction (English/Turkish)
- `{{LANGUAGE_SPECIFIC_RULES}}` — Auto-detected language rules (Rust/TS/Python/Go)
- `{{MODEL_CUSTOM_INSTRUCTION}}` — User's custom model instruction (sandboxed)

## User Overrides
Place a file at `.guardian/prompts/{name}.md` in your workspace to override any template.
This enables per-project prompt customization without modifying Guardian source.
