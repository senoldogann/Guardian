#!/usr/bin/env python3
"""
Test Runner - Unified test execution with coverage reporting
Part of Maestro Rules & Scripts Quality Control System

Supports: TypeScript/JavaScript (Jest, Vitest), Python (pytest), Go, Rust, Java
"""

import subprocess
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class TestFramework(Enum):
    JEST = "jest"
    VITEST = "vitest"
    PYTEST = "pytest"
    GO_TEST = "go_test"
    CARGO_TEST = "cargo_test"
    GRADLE = "gradle"
    MAVEN = "maven"
    DOTNET = "dotnet"


@dataclass
class TestResult:
    framework: TestFramework
    success: bool
    passed: int
    failed: int
    skipped: int
    coverage: Optional[float]
    duration_seconds: float
    output: str


class TestRunner:
    """Universal test runner with framework detection and coverage tracking."""

    FRAMEWORK_DETECTION: Dict[TestFramework, List[str]] = {
        TestFramework.VITEST: ["vitest.config.ts", "vitest.config.js"],
        TestFramework.JEST: ["jest.config.js", "jest.config.ts", "jest.config.json"],
        TestFramework.PYTEST: [
            "pytest.ini",
            "pyproject.toml",
            "setup.py",
            "conftest.py",
        ],
        TestFramework.GO_TEST: ["go.mod"],
        TestFramework.CARGO_TEST: ["Cargo.toml"],
        TestFramework.GRADLE: ["build.gradle", "build.gradle.kts"],
        TestFramework.MAVEN: ["pom.xml"],
        TestFramework.DOTNET: ["*.csproj", "*.sln"],
    }

    TEST_COMMANDS: Dict[TestFramework, List[str]] = {
        TestFramework.VITEST: ["npx", "vitest", "run", "--reporter=json", "--coverage"],
        TestFramework.JEST: ["npx", "jest", "--json", "--coverage"],
        TestFramework.PYTEST: [
            "python3",
            "-m",
            "pytest",
            "-v",
            "--tb=short",
            "--cov=.",
            "--cov-report=json",
        ],
        TestFramework.GO_TEST: ["go", "test", "-v", "-cover", "./..."],
        TestFramework.CARGO_TEST: ["cargo", "test", "--", "--nocapture"],
        TestFramework.GRADLE: ["./gradlew", "test", "--info"],
        TestFramework.MAVEN: ["mvn", "test"],
        TestFramework.DOTNET: ["dotnet", "test", '--collect:"XPlat Code Coverage"'],
    }

    COVERAGE_THRESHOLD = 80.0  # Minimum required coverage percentage

    def __init__(self, project_path: str):
        self.project_path = Path(project_path).resolve()
        self.results: List[TestResult] = []

    def detect_framework(self) -> Optional[TestFramework]:
        """Detect which test framework is used in the project."""
        for framework, files in self.FRAMEWORK_DETECTION.items():
            for file_pattern in files:
                if "*" in file_pattern:
                    if list(self.project_path.glob(file_pattern)):
                        return framework
                elif (self.project_path / file_pattern).exists():
                    return framework

        # Check package.json for JS/TS projects
        pkg_json = self.project_path / "package.json"
        if pkg_json.exists():
            try:
                with open(pkg_json) as f:
                    pkg = json.load(f)
                    deps = {
                        **pkg.get("devDependencies", {}),
                        **pkg.get("dependencies", {}),
                    }
                    if "vitest" in deps:
                        return TestFramework.VITEST
                    if "jest" in deps:
                        return TestFramework.JEST
            except json.JSONDecodeError:
                pass

        return None

    def _run_command(self, cmd: List[str], cwd: Path) -> Tuple[int, str, str, float]:
        """Run a command and return exit code, stdout, stderr, duration."""
        import time

        start = time.time()
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout
            )
            duration = time.time() - start
            return result.returncode, result.stdout, result.stderr, duration
        except FileNotFoundError:
            return -1, "", f"Command not found: {cmd[0]}", 0
        except subprocess.TimeoutExpired:
            return -2, "", "Tests timed out after 10 minutes", time.time() - start

    def _parse_results(
        self, output: str, framework: TestFramework
    ) -> Tuple[int, int, int, Optional[float]]:
        """Parse test output to extract passed, failed, skipped, coverage."""
        passed, failed, skipped = 0, 0, 0
        coverage = None

        if framework in [TestFramework.JEST, TestFramework.VITEST]:
            # Try JSON parse for Jest/Vitest
            try:
                data = json.loads(output)
                passed = data.get("numPassedTests", 0)
                failed = data.get("numFailedTests", 0)
                skipped = data.get("numPendingTests", 0)
                if "coverageMap" in data:
                    # Calculate average coverage
                    total, count = 0, 0
                    for file_data in data["coverageMap"].values():
                        if "statementMap" in file_data:
                            total += file_data.get("s", {}).get("pct", 0)
                            count += 1
                    if count > 0:
                        coverage = total / count
            except json.JSONDecodeError:
                # Fallback to regex parsing
                pass

        elif framework == TestFramework.PYTEST:
            # Parse pytest output
            match = re.search(r"(\d+) passed", output)
            if match:
                passed = int(match.group(1))
            match = re.search(r"(\d+) failed", output)
            if match:
                failed = int(match.group(1))
            match = re.search(r"(\d+) skipped", output)
            if match:
                skipped = int(match.group(1))
            # Coverage from pytest-cov
            match = re.search(r"TOTAL\s+\d+\s+\d+\s+(\d+)%", output)
            if match:
                coverage = float(match.group(1))

        elif framework == TestFramework.GO_TEST:
            # Parse go test output
            passed = output.count("--- PASS:")
            failed = output.count("--- FAIL:")
            skipped = output.count("--- SKIP:")
            match = re.search(r"coverage: ([\d.]+)%", output)
            if match:
                coverage = float(match.group(1))

        elif framework == TestFramework.CARGO_TEST:
            # Parse cargo test output
            match = re.search(r"(\d+) passed", output)
            if match:
                passed = int(match.group(1))
            match = re.search(r"(\d+) failed", output)
            if match:
                failed = int(match.group(1))
            match = re.search(r"(\d+) ignored", output)
            if match:
                skipped = int(match.group(1))

        # Generic fallback parsing
        if passed == 0 and failed == 0:
            passed = output.lower().count("pass")
            failed = output.lower().count("fail")

        return passed, failed, skipped, coverage

    def run_tests(self, framework: Optional[TestFramework] = None) -> TestResult:
        """Run tests for the detected or specified framework."""
        if framework is None:
            framework = self.detect_framework()

        if framework is None:
            return TestResult(
                framework=TestFramework.JEST,  # Placeholder
                success=False,
                passed=0,
                failed=0,
                skipped=0,
                coverage=None,
                duration_seconds=0,
                output="No test framework detected",
            )

        cmd = self.TEST_COMMANDS.get(framework)
        if not cmd:
            return TestResult(
                framework=framework,
                success=False,
                passed=0,
                failed=0,
                skipped=0,
                coverage=None,
                duration_seconds=0,
                output=f"No test command configured for {framework.value}",
            )

        exit_code, stdout, stderr, duration = self._run_command(cmd, self.project_path)
        output = stdout + stderr
        passed, failed, skipped, coverage = self._parse_results(output, framework)

        return TestResult(
            framework=framework,
            success=exit_code == 0 and failed == 0,
            passed=passed,
            failed=failed,
            skipped=skipped,
            coverage=coverage,
            duration_seconds=duration,
            output=output[:5000] if len(output) > 5000 else output,
        )

    def run(self) -> Dict:
        """Run tests and generate report."""
        print(f"\n{'=' * 60}")
        print("TEST RUNNER - Quality Control")
        print(f"{'=' * 60}")
        print(f"Project: {self.project_path}")

        framework = self.detect_framework()
        if not framework:
            print("❌ No test framework detected!")
            return {"success": False, "error": "No test framework detected"}

        print(f"Framework: {framework.value}")
        print(f"Coverage threshold: {self.COVERAGE_THRESHOLD}%")
        print(f"{'=' * 60}\n")

        print("[TEST] Running tests...")
        result = self.run_tests(framework)
        self.results.append(result)

        # Display results
        status = "✅ PASS" if result.success else "❌ FAIL"
        print(f"\n{status}")
        print(f"  Passed:  {result.passed}")
        print(f"  Failed:  {result.failed}")
        print(f"  Skipped: {result.skipped}")
        print(f"  Duration: {result.duration_seconds:.2f}s")

        if result.coverage is not None:
            cov_status = "✅" if result.coverage >= self.COVERAGE_THRESHOLD else "⚠️"
            print(f"  Coverage: {cov_status} {result.coverage:.1f}%")

            if result.coverage < self.COVERAGE_THRESHOLD:
                print(
                    f"\n⚠️  WARNING: Coverage {result.coverage:.1f}% is below threshold {self.COVERAGE_THRESHOLD}%"
                )
        else:
            print("  Coverage: Not available")

        print(f"\n{'=' * 60}")

        meets_coverage = (
            result.coverage is None or result.coverage >= self.COVERAGE_THRESHOLD
        )

        return {
            "success": result.success and meets_coverage,
            "framework": framework.value,
            "passed": result.passed,
            "failed": result.failed,
            "skipped": result.skipped,
            "coverage": result.coverage,
            "coverage_threshold": self.COVERAGE_THRESHOLD,
            "meets_coverage_threshold": meets_coverage,
            "duration_seconds": result.duration_seconds,
        }


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Run tests with coverage tracking")
    parser.add_argument("path", nargs="?", default=".", help="Project path")
    parser.add_argument("--report", "-r", help="Output JSON report path")
    parser.add_argument(
        "--threshold", "-t", type=float, default=80.0, help="Coverage threshold"
    )

    args = parser.parse_args()

    runner = TestRunner(args.path)
    runner.COVERAGE_THRESHOLD = args.threshold

    report = runner.run()

    if args.report:
        with open(args.report, "w") as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to: {args.report}")

    sys.exit(0 if report.get("success", False) else 1)


if __name__ == "__main__":
    main()
