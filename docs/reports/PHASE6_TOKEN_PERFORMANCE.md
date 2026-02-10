# Phase 6.2 Token Performance Report

Date: 2026-02-10

## Objective

Measure token impact of diff-focused AI context (Phase 6.2) versus snapshot-compressed context under the same truncation limits.

## Method

Repro command:

```bash
cd guardian/src-tauri
cargo test diff_context_reduces_token_estimate_for_localized_change -- --nocapture
```

Benchmark test:
- File: `src-tauri/src/watcher.rs`
- Test: `watcher::tests_protocol::diff_context_reduces_token_estimate_for_localized_change`
- Context limits: `max_lines=220`, `max_chars=6000` (default runtime limits)
- Scenario:
  - 400-line file
  - localized single-line change
  - comparison:
    - snapshot mode (`previous=None`)
    - diff-focused mode (`previous=Some(...)`)

## Result

Observed output:

```text
diff-benchmark snapshot_tokens=1504 diff_tokens=127
```

Derived metrics:
- Absolute saving: `1377` tokens
- Relative saving: `91.56%`

## Interpretation

- Diff-focused context provides major token reduction when edits are localized.
- First audit still uses snapshot-compressed mode by design; savings mainly appear on subsequent audits with prior snapshot.
- Savings vary by change spread:
  - localized changes: very high savings
  - broad file rewrites: lower savings (still bounded by truncation and hunk limits)

## Related Controls

- `DIFF_MAX_HUNKS` limits diff payload size.
- Line/char truncation remains active after diff construction.
- Estimated token calculation currently uses rough `chars/4` approximation.
