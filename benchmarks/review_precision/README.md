# Review Precision Benchmark

Purpose: measure Guardian finding quality for the release-governance flow.

## Input Format

Provide a JSONL file where each line is a labeled evaluation case:

```json
{"case_id":"case-001","expected_severity":"critical","predicted_severity":"critical","expected_block":true,"predicted_decision":"BLOCK_UNTIL_APPROVED","notes":"sql injection path"}
```

Required fields:
- `case_id` (string)
- `expected_severity` (`critical|warning|info|none`)
- `predicted_severity` (`critical|warning|info|none`)

Optional fields:
- `expected_block` (boolean)
- `predicted_decision` (`PASS|PASS_WITH_WARNING|BLOCK_UNTIL_APPROVED|OVERRIDDEN`)
- `notes` (string)

## Run

```bash
python3 scripts/review_precision_benchmark.py \
  --input benchmarks/review_precision/sample.baseline.jsonl
```

## Output

Reports are written under:

```
.guardian/benchmarks/review-precision/<YYYY-MM-DD>/
  report.json
  report.md
```

Use these metrics in Faz A (Accuracy Lockdown) gates:
- critical precision
- warning precision
- false positive rate
- block precision/recall (if block labels are present)
