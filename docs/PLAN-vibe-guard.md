# PLAN: Vibe Guard & Token Optimization

## Goal
Transform Guardian into a high-authority, cost-efficient security guard for real-time AI development sessions.

## Phase 1: Context & Discovery
- [ ] Read `watcher.rs` and `ai_client.rs` to map current analysis flow. → Verify: Done.
- [ ] Identify all non-logic file extensions to be excluded from auto-scan. → Verify: List created.

## Phase 2: Backend Optimization (Efficiency)
- [ ] Implement `LogicFilter` in `watcher.rs`: Skip `.css`, `.json`, `.md`, `.svg` by default. → Verify: Only code changes trigger AI.
- [ ] Implement `AdaptiveDebounce`: Throttling based on character change frequency to batch edits during "vibe coding" sessions. → Verify: Reduced AI call count during heavy typing.

## Phase 3: High-Authority Persona & Handshake
- [ ] Update `ai_client.rs` prompt to strictly enforce SPAP v2.2 and "Architect's Why". (Implemented, but needs refinement). → Verify: Critiques are educational.
- [ ] Ensure `.guardian/STALL` and `.guardian/critiques.md` are formatted for AI Assistant consumption. → Verify: Handshake bridge works.

## Phase 4: Frontend (Visibility & Metrics)
- [ ] Add `TokenUsageTracker` state in `App.tsx`. → Verify: State tracks count.
- [ ] Create `CostMetric` component in UI. → Verify: User sees usage.
- [ ] Implement "Critical Stall Overlay" for high-severity issues. → Verify: UI visually "stops" the user on critical errors.

## Phase 5: Verification (Final Audit)
- [ ] Run `cargo check` and `npm run build`.
- [ ] Execute `security_scan.py` and `lint_runner.py`.
- [ ] Manual "Vibe Coding" test to verify cost savings.

## Done When
- [ ] Logic-only filtering is active.
- [ ] Token usage is visible in UI.
- [ ] Critical errors visually stall the session.
- [ ] Total AI calls reduced by ~40% for typical sessions.
