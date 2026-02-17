#!/usr/bin/env python3
"""
Lint Runner - Unified linting for multiple languages
Part of Maestro Rules & Scripts Quality Control System

Supports: TypeScript, JavaScript, Python, Go, Rust, Java, C#
"""

import subprocess
import sys
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class Language(Enum):
    TYPESCRIPT = "typescript"
    JAVASCRIPT = "javascript"
    PYTHON = "python"
    GO = "go"
    RUST = "rust"
    JAVA = "java"
    CSHARP = "csharp"


@dataclass
class LintResult:
    language: Language
    success: bool
    errors: int
    warnings: int
    files_checked: int
    output: str


class LintRunner:
    """Universal lint runner with language detection and execution."""

    LINT_COMMANDS: Dict[Language, List[str]] = {
        Language.TYPESCRIPT: ["npx", "eslint", "--ext", ".ts,.tsx", "."],
        Language.JAVASCRIPT: ["npx", "eslint", "--ext", ".js,.jsx", "."],
        Language.PYTHON: ["python3", "-m", "ruff", "check", "."],
        Language.GO: ["golangci-lint", "run", "./..."],
        Language.RUST: ["cargo", "clippy", "--", "-D", "warnings"],
        Language.JAVA: ["./gradlew", "checkstyleMain"],
        Language.CSHARP: ["dotnet", "format", "--verify-no-changes"],
    }

    FALLBACK_COMMANDS: Dict[Language, List[str]] = {
        Language.PYTHON: ["python3", "-m", "flake8", "."],
        Language.TYPESCRIPT: ["npx", "biome", "check", "."],
        Language.JAVASCRIPT: ["npx", "biome", "check", "."],
    }

    FILE_PATTERNS: Dict[Language, List[str]] = {
        Language.TYPESCRIPT: ["**/*.ts", "**/*.tsx"],
        Language.JAVASCRIPT: ["**/*.js", "**/*.jsx"],
        Language.PYTHON: ["**/*.py"],
        Language.GO: ["**/*.go"],
        Language.RUST: ["**/*.rs"],
        Language.JAVA: ["**/*.java"],
        Language.CSHARP: ["**/*.cs"],
    }

    def __init__(self, project_path: str):
        self.project_path = Path(project_path).resolve()
        self.results: List[LintResult] = []

    def detect_languages(self) -> List[Language]:
        """Detect which languages are used in the project."""
        detected = []
        for lang, patterns in self.FILE_PATTERNS.items():
            for pattern in patterns:
                if list(self.project_path.glob(pattern)):
                    detected.append(lang)
                    break
        return detected

    def _run_command(self, cmd: List[str], cwd: Path) -> Tuple[int, str, str]:
        """Run a command and return exit code, stdout, stderr."""
        try:
            result = subprocess.run(
                cmd, cwd=cwd, capture_output=True, text=True, timeout=300
            )
            return result.returncode, result.stdout, result.stderr
        except FileNotFoundError:
            return -1, "", f"Command not found: {cmd[0]}"
        except subprocess.TimeoutExpired:
            return -2, "", "Command timed out after 5 minutes"

    def _count_issues(self, output: str, lang: Language) -> Tuple[int, int]:
        """Parse output to count errors and warnings."""
        errors, warnings = 0, 0
        lines = output.lower().split("\n")

        for line in lines:
            if "error" in line:
                errors += 1
            if "warning" in line or "warn" in line:
                warnings += 1

        return errors, warnings

    def run_lint(self, language: Language) -> LintResult:
        """Run linter for a specific language."""
        cmd = self.LINT_COMMANDS.get(language)
        if not cmd:
            return LintResult(language, False, 0, 0, 0, "No linter configured")

        exit_code, stdout, stderr = self._run_command(cmd, self.project_path)

        # Try fallback if primary fails with command not found
        if exit_code == -1 and language in self.FALLBACK_COMMANDS:
            cmd = self.FALLBACK_COMMANDS[language]
            exit_code, stdout, stderr = self._run_command(cmd, self.project_path)

        output = stdout + stderr
        errors, warnings = self._count_issues(output, language)

        # Count files
        files_checked = 0
        for pattern in self.FILE_PATTERNS.get(language, []):
            files_checked += len(list(self.project_path.glob(pattern)))

        return LintResult(
            language=language,
            success=exit_code == 0,
            errors=errors,
            warnings=warnings,
            files_checked=files_checked,
            output=output[:2000] if len(output) > 2000 else output,
        )

    def run_all(self) -> Dict:
        """Run linters for all detected languages."""
        languages = self.detect_languages()

        print(f"\n{'=' * 60}")
        print("LINT RUNNER - Quality Control")
        print(f"{'=' * 60}")
        print(f"Project: {self.project_path}")
        print(f"Detected languages: {[l.value for l in languages]}")
        print(f"{'=' * 60}\n")

        total_errors = 0
        total_warnings = 0
        all_passed = True

        for lang in languages:
            print(f"[LINT] Running {lang.value} linter...")
            result = self.run_lint(lang)
            self.results.append(result)

            status = "✅ PASS" if result.success else "❌ FAIL"
            print(
                f"  {status} - {result.errors} errors, {result.warnings} warnings ({result.files_checked} files)"
            )

            if not result.success:
                all_passed = False
            total_errors += result.errors
            total_warnings += result.warnings

        print(f"\n{'=' * 60}")
        print("SUMMARY")
        print(f"{'=' * 60}")
        print(f"Total Errors: {total_errors}")
        print(f"Total Warnings: {total_warnings}")
        print(f"Overall Status: {'✅ ALL PASSED' if all_passed else '❌ ISSUES FOUND'}")
        print(f"{'=' * 60}\n")

        return {
            "success": all_passed,
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "languages_checked": [l.value for l in languages],
            "results": [
                {
                    "language": r.language.value,
                    "success": r.success,
                    "errors": r.errors,
                    "warnings": r.warnings,
                    "files_checked": r.files_checked,
                }
                for r in self.results
            ],
        }

    def generate_report(self, output_path: Optional[str] = None) -> str:
        """Generate JSON report of lint results."""
        report = self.run_all()

        if output_path:
            with open(output_path, "w") as f:
                json.dump(report, f, indent=2)
            print(f"Report saved to: {output_path}")

        return json.dumps(report, indent=2)


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Run linters for multiple languages")
    parser.add_argument("path", nargs="?", default=".", help="Project path to lint")
    parser.add_argument("--report", "-r", help="Output JSON report path")
    parser.add_argument("--language", "-l", help="Specific language to lint")

    args = parser.parse_args()

    runner = LintRunner(args.path)

    if args.language:
        try:
            lang = Language(args.language.lower())
            result = runner.run_lint(lang)
            print(f"Result: {'PASS' if result.success else 'FAIL'}")
            sys.exit(0 if result.success else 1)
        except ValueError:
            print(f"Unknown language: {args.language}")
            print(f"Supported: {[l.value for l in Language]}")
            sys.exit(1)
    else:
        report = runner.run_all()

        if args.report:
            with open(args.report, "w") as f:
                json.dump(report, f, indent=2)

        sys.exit(0 if report["success"] else 1)


if __name__ == "__main__":
    main()
