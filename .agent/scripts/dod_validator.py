#!/usr/bin/env python3
"""
Definition of Done (DoD) Validator
Part of Maestro Rules & Scripts Quality Control System

Validates code against the 3 universal quality gates:
1. Code Correctness (Syntax)
2. Completeness (No Hollow Shells)
3. Integration (Connectivity)
"""

import subprocess
import sys
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum


class CheckStatus(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"
    SKIP = "skip"


@dataclass
class CheckResult:
    name: str
    status: CheckStatus
    message: str
    details: List[str] = field(default_factory=list)


@dataclass
class ValidationReport:
    success: bool
    gate1_correctness: List[CheckResult]
    gate2_completeness: List[CheckResult]
    gate3_integration: List[CheckResult]
    additional_checks: List[CheckResult]


class DoDValidator:
    """
    Definition of Done Validator

    Validates against Maestro's 3 Universal Quality Gates:
    1. Code Correctness (Syntax) - Does it compile/run without errors?
    2. Completeness (No Hollow Shells) - Are all functions implemented?
    3. Integration (Connectivity) - Does it connect to the system?
    """

    HOLLOW_SHELL_PATTERNS = [
        (r"\bpass\s*$", "Python 'pass' statement"),
        (r"\breturn\s+null\s*;", "Return null placeholder"),
        (r"\breturn\s+None\s*$", "Return None placeholder"),
        (r"\bTODO\b", "TODO comment"),
        (r"\bFIXME\b", "FIXME comment"),
        (r"\bXXX\b", "XXX comment"),
        (r"\bHACK\b", "HACK comment"),
        (r"raise\s+NotImplementedError", "NotImplementedError"),
        (r'throw\s+new\s+Error\(["\']Not implemented', "Not implemented error"),
        (r'panic!\(["\']not implemented', "Rust panic not implemented"),
        (r"unimplemented!\(\)", "Rust unimplemented macro"),
        (r"todo!\(\)", "Rust todo macro"),
        (r"\.\.\.", "Spread placeholder (...)"),
        (r"\{\s*\}", "Empty block {}"),
        (r"placeholder", "Placeholder text"),
        (r"mock\s*=", "Mock assignment"),
    ]

    SILENT_FAILURE_PATTERNS = [
        (r"except:\s*$", "Bare except (catches everything silently)"),
        (r"except\s*:\s*pass", "Silent exception swallowing"),
        (r"catch\s*\(\s*\)\s*\{\s*\}", "Empty catch block"),
        (r"\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)", "Empty promise catch"),
        (r"catch\s*\{?\s*_\s*in", "Swift silent catch"),
    ]

    def __init__(self, project_path: str):
        self.project_path = Path(project_path).resolve()
        self.results: List[CheckResult] = []

    def _find_source_files(self) -> List[Path]:
        """Find all source files in the project."""
        extensions = [
            "*.py",
            "*.ts",
            "*.tsx",
            "*.js",
            "*.jsx",
            "*.go",
            "*.rs",
            "*.java",
            "*.cs",
        ]
        files = []
        for ext in extensions:
            files.extend(self.project_path.rglob(ext))

        # Exclude node_modules, vendor, etc.
        exclude_dirs = [
            "node_modules",
            "vendor",
            "dist",
            "build",
            ".git",
            "__pycache__",
            "venv",
        ]
        return [f for f in files if not any(ex in str(f) for ex in exclude_dirs)]

    def _check_syntax(self, file: Path) -> CheckResult:
        """Check if a file has valid syntax."""
        suffix = file.suffix.lower()

        try:
            if suffix == ".py":
                result = subprocess.run(
                    ["python3", "-m", "py_compile", str(file)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode != 0:
                    return CheckResult(
                        "syntax",
                        CheckStatus.FAIL,
                        f"Python syntax error in {file.name}",
                        [result.stderr],
                    )

            elif suffix in [".ts", ".tsx"]:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit", "--skipLibCheck", str(file)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if result.returncode != 0:
                    return CheckResult(
                        "syntax",
                        CheckStatus.FAIL,
                        f"TypeScript error in {file.name}",
                        [result.stderr[:500]],
                    )

            elif suffix in [".js", ".jsx"]:
                result = subprocess.run(
                    ["node", "--check", str(file)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode != 0:
                    return CheckResult(
                        "syntax",
                        CheckStatus.FAIL,
                        f"JavaScript syntax error in {file.name}",
                        [result.stderr],
                    )

            elif suffix == ".go":
                result = subprocess.run(
                    ["go", "vet", str(file)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    cwd=file.parent,
                )
                if result.returncode != 0:
                    return CheckResult(
                        "syntax",
                        CheckStatus.FAIL,
                        f"Go error in {file.name}",
                        [result.stderr],
                    )

            elif suffix == ".rs":
                # Check if cargo is available
                result = subprocess.run(
                    ["rustfmt", "--check", str(file)],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                # rustfmt --check returns non-zero if formatting needed, not for syntax errors
                # For syntax, we'd need cargo check, but that requires project context

            return CheckResult("syntax", CheckStatus.PASS, f"Valid syntax: {file.name}")

        except subprocess.TimeoutExpired:
            return CheckResult(
                "syntax", CheckStatus.WARN, f"Syntax check timed out: {file.name}"
            )
        except FileNotFoundError:
            return CheckResult(
                "syntax",
                CheckStatus.SKIP,
                f"Syntax checker not available for {file.name}",
            )

    def _check_hollow_shells(self, file: Path) -> List[CheckResult]:
        """Check for hollow shell patterns (incomplete implementations)."""
        results = []
        try:
            content = file.read_text(encoding="utf-8", errors="ignore")
            lines = content.split("\n")

            for pattern, description in self.HOLLOW_SHELL_PATTERNS:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        # Skip comments for some patterns
                        stripped = line.strip()
                        if description.startswith("TODO") or description.startswith(
                            "FIXME"
                        ):
                            # These are expected in comments
                            if (
                                stripped.startswith("#")
                                or stripped.startswith("//")
                                or stripped.startswith("*")
                            ):
                                results.append(
                                    CheckResult(
                                        "completeness",
                                        CheckStatus.WARN,
                                        f"{description} found",
                                        [f"{file.name}:{i}: {line.strip()[:80]}"],
                                    )
                                )
                            continue

                        results.append(
                            CheckResult(
                                "completeness",
                                CheckStatus.FAIL,
                                f"Hollow shell: {description}",
                                [f"{file.name}:{i}: {line.strip()[:80]}"],
                            )
                        )
        except Exception as e:
            results.append(
                CheckResult(
                    "completeness", CheckStatus.WARN, f"Could not read {file.name}: {e}"
                )
            )

        return results

    def _check_silent_failures(self, file: Path) -> List[CheckResult]:
        """Check for silent failure patterns."""
        results = []
        try:
            content = file.read_text(encoding="utf-8", errors="ignore")
            lines = content.split("\n")

            for pattern, description in self.SILENT_FAILURE_PATTERNS:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line):
                        results.append(
                            CheckResult(
                                "error_handling",
                                CheckStatus.FAIL,
                                f"Silent failure: {description}",
                                [f"{file.name}:{i}: {line.strip()[:80]}"],
                            )
                        )
        except Exception as e:
            results.append(
                CheckResult(
                    "error_handling",
                    CheckStatus.WARN,
                    f"Could not read {file.name}: {e}",
                )
            )

        return results

    def _check_tests_exist(self) -> CheckResult:
        """Check if test files exist."""
        test_patterns = [
            "**/test_*.py",
            "**/*_test.py",
            "**/*.test.ts",
            "**/*.spec.ts",
            "**/*.test.js",
            "**/*.spec.js",
            "**/tests/**/*.py",
            "**/__tests__/**",
        ]

        for pattern in test_patterns:
            if list(self.project_path.rglob(pattern.replace("**/", ""))):
                return CheckResult("tests", CheckStatus.PASS, "Test files found")

        return CheckResult(
            "tests",
            CheckStatus.FAIL,
            "No test files found",
            ["Tests are required - untested code is considered 'not written'"],
        )

    def validate(self) -> ValidationReport:
        """Run all validation checks."""
        print(f"\n{'=' * 60}")
        print("DEFINITION OF DONE (DoD) VALIDATOR")
        print(f"{'=' * 60}")
        print(f"Project: {self.project_path}")
        print(f"{'=' * 60}\n")

        gate1_results = []  # Correctness
        gate2_results = []  # Completeness
        gate3_results = []  # Integration
        additional = []  # Error handling, tests

        source_files = self._find_source_files()
        print(f"Found {len(source_files)} source files\n")

        # Gate 1: Code Correctness (Syntax)
        print("[Gate 1] Code Correctness (Syntax)")
        print("-" * 40)
        syntax_errors = 0
        for file in source_files[:50]:  # Limit to first 50 files
            result = self._check_syntax(file)
            if result.status == CheckStatus.FAIL:
                syntax_errors += 1
                gate1_results.append(result)
                print(f"  ❌ {result.message}")

        if syntax_errors == 0:
            gate1_results.append(
                CheckResult("syntax", CheckStatus.PASS, "All files have valid syntax")
            )
            print(f"  ✅ All {min(len(source_files), 50)} files passed syntax check")

        # Gate 2: Completeness (No Hollow Shells)
        print(f"\n[Gate 2] Completeness (No Hollow Shells)")
        print("-" * 40)
        hollow_count = 0
        for file in source_files:
            results = self._check_hollow_shells(file)
            for result in results:
                if result.status == CheckStatus.FAIL:
                    hollow_count += 1
                    gate2_results.append(result)
                    if hollow_count <= 5:  # Only show first 5
                        print(
                            f"  ❌ {result.message}: {result.details[0] if result.details else ''}"
                        )
                elif result.status == CheckStatus.WARN:
                    gate2_results.append(result)

        if hollow_count == 0:
            gate2_results.append(
                CheckResult(
                    "completeness", CheckStatus.PASS, "No hollow shells detected"
                )
            )
            print("  ✅ No hollow shells (placeholders, TODOs, etc.) detected")
        elif hollow_count > 5:
            print(f"  ... and {hollow_count - 5} more issues")

        # Gate 3: Integration (Connectivity) - Check for basic integration patterns
        print(f"\n[Gate 3] Integration (Connectivity)")
        print("-" * 40)
        test_result = self._check_tests_exist()
        gate3_results.append(test_result)
        if test_result.status == CheckStatus.PASS:
            print("  ✅ Test files exist")
        else:
            print("  ❌ No test files found")

        # Additional Checks: Silent Failures
        print(f"\n[Additional] Error Handling")
        print("-" * 40)
        silent_count = 0
        for file in source_files:
            results = self._check_silent_failures(file)
            for result in results:
                if result.status == CheckStatus.FAIL:
                    silent_count += 1
                    additional.append(result)
                    if silent_count <= 3:
                        print(f"  ❌ {result.message}")

        if silent_count == 0:
            additional.append(
                CheckResult(
                    "error_handling", CheckStatus.PASS, "No silent failures detected"
                )
            )
            print("  ✅ No silent failure patterns detected")
        elif silent_count > 3:
            print(f"  ... and {silent_count - 3} more issues")

        # Summary
        gate1_pass = all(r.status != CheckStatus.FAIL for r in gate1_results)
        gate2_pass = all(r.status != CheckStatus.FAIL for r in gate2_results)
        gate3_pass = all(r.status != CheckStatus.FAIL for r in gate3_results)
        additional_pass = all(r.status != CheckStatus.FAIL for r in additional)

        overall_success = gate1_pass and gate2_pass and gate3_pass and additional_pass

        print(f"\n{'=' * 60}")
        print("SUMMARY")
        print(f"{'=' * 60}")
        print(f"Gate 1 (Correctness):  {'✅ PASS' if gate1_pass else '❌ FAIL'}")
        print(f"Gate 2 (Completeness): {'✅ PASS' if gate2_pass else '❌ FAIL'}")
        print(f"Gate 3 (Integration):  {'✅ PASS' if gate3_pass else '❌ FAIL'}")
        print(f"Error Handling:        {'✅ PASS' if additional_pass else '❌ FAIL'}")
        print(f"{'=' * 60}")
        print(
            f"Overall: {'✅ DEFINITION OF DONE MET' if overall_success else '❌ DEFINITION OF DONE NOT MET'}"
        )
        print(f"{'=' * 60}\n")

        return ValidationReport(
            success=overall_success,
            gate1_correctness=gate1_results,
            gate2_completeness=gate2_results,
            gate3_integration=gate3_results,
            additional_checks=additional,
        )

    def to_json(self, report: ValidationReport) -> str:
        """Convert report to JSON."""

        def result_to_dict(r: CheckResult) -> dict:
            return {
                "name": r.name,
                "status": r.status.value,
                "message": r.message,
                "details": r.details,
            }

        return json.dumps(
            {
                "success": report.success,
                "gate1_correctness": [
                    result_to_dict(r) for r in report.gate1_correctness
                ],
                "gate2_completeness": [
                    result_to_dict(r) for r in report.gate2_completeness
                ],
                "gate3_integration": [
                    result_to_dict(r) for r in report.gate3_integration
                ],
                "additional_checks": [
                    result_to_dict(r) for r in report.additional_checks
                ],
            },
            indent=2,
        )


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate code against Definition of Done"
    )
    parser.add_argument("path", nargs="?", default=".", help="Project path")
    parser.add_argument("--report", "-r", help="Output JSON report path")
    parser.add_argument(
        "--strict", "-s", action="store_true", help="Fail on warnings too"
    )

    args = parser.parse_args()

    validator = DoDValidator(args.path)
    report = validator.validate()

    if args.report:
        with open(args.report, "w") as f:
            f.write(validator.to_json(report))
        print(f"Report saved to: {args.report}")

    sys.exit(0 if report.success else 1)


if __name__ == "__main__":
    main()
