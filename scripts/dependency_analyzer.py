#!/usr/bin/env python3
import os
import sys
import subprocess
import json
import argparse
from typing import Optional

# Add scripts dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common_utils import print_header, print_success, print_fail, print_info, print_warning, file_exists

ROOT_DIR = os.getcwd()

def parse_node_vulnerabilities(raw_json: str) -> Optional[int]:
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    metadata = payload.get("metadata", {})
    vulnerabilities = metadata.get("vulnerabilities", {})
    if isinstance(vulnerabilities, dict):
        total = 0
        for key, value in vulnerabilities.items():
            if key == "total":
                continue
            if isinstance(value, int):
                total += value
        if total == 0 and isinstance(vulnerabilities.get("total"), int):
            total = vulnerabilities["total"]
        return total
    return None


def audit_nodejs(strict_security: bool):
    if file_exists("package.json"):
        print_info("Analyzing Node.js dependencies...")
        try:
            # Check for generic 'any' usage in TS/JS if possible? 
            # For now, let's stick to dependency audit.
            result = subprocess.run(["npm", "audit", "--json"], capture_output=True, text=True)
            # npm audit returns non-zero for found vulnerabilities
            if result.returncode == 0:
                print_success("Node.js audit: No vulnerabilities found.")
                return True
            else:
                vuln_count = parse_node_vulnerabilities(result.stdout)
                if vuln_count is None:
                    print_warning("Node.js audit: Found potential vulnerabilities (count unavailable).")
                else:
                    print_warning(f"Node.js audit: Found potential vulnerabilities (count={vuln_count}).")
                if strict_security:
                    print_fail("Node.js audit: strict mode active, failing on vulnerabilities.")
                    return False
                return True 
        except FileNotFoundError:
            print_warning("npm command not found. Skipping Node.js audit.")
    return True


def parse_python_vulnerabilities(raw_output: str) -> int:
    # pip-audit output generally has one advisory per line after headers.
    lines = [line.strip() for line in raw_output.splitlines() if line.strip()]
    # Best effort: if table output exists, first non-header rows are vulnerabilities.
    # We subtract probable header row when present.
    if not lines:
        return 0
    header_markers = ("name", "version", "id", "fix versions")
    lowered_first = lines[0].lower()
    if all(marker in lowered_first for marker in header_markers):
        return max(0, len(lines) - 1)
    return len(lines)


def audit_python(strict_security: bool):
    if file_exists("requirements.txt"):
        print_info("Analyzing Python dependencies...")
        try:
            # Requires pip-audit to be installed
            result = subprocess.run(["pip-audit", "-r", "requirements.txt"], capture_output=True, text=True)
            if result.returncode == 0:
                print_success("Python audit: No vulnerabilities found.")
                return True
            else:
                vuln_count = parse_python_vulnerabilities(result.stdout)
                print_warning(f"Python audit: Found potential vulnerabilities (count~={vuln_count}).")
                if strict_security:
                    print_fail("Python audit: strict mode active, failing on vulnerabilities.")
                    return False
                return True
        except FileNotFoundError:
            print_warning("pip-audit command not found. Skipping Python audit.")
    return True


def audit_go():
    if file_exists("go.mod"):
        print_info("Analyzing Go modules...")
        try:
            result = subprocess.run(["go", "list", "-m", "all"], capture_output=True, text=True)
            if result.returncode == 0:
                print_success("Go modules: Successfully listed.")
                return True
        except FileNotFoundError:
            print_warning("go command not found. Skipping Go audit.")
    return True

def extract_files_from_codebase():
    codebase_path = os.path.join(ROOT_DIR, ".maestro", "SYSTEM.md")
    if not file_exists(codebase_path):
        return []
    
    files = []
    try:
        with open(codebase_path, 'r') as f:
            for line in f:
                if "├──" in line or "└──" in line:
                    name = line.split("─")[-1].split("#")[0].strip()
                    if name and not name.endswith("/"):
                        files.append(name)
    except Exception:
        pass
    return files

def audit_structure():
    print_info("Auditing Codebase Structure (Map vs. Territory)...")
    codebase_files = extract_files_from_codebase()
    if not codebase_files:
        return True # Skip if no codebase map exists
    
    all_ok = True
    for f in codebase_files:
        # Simplified check for major files
        if f in [".maestro/SYSTEM.md", "AGENTS.md", "README.md"]:
            if not file_exists(os.path.join(ROOT_DIR, f)):
                print_warning(f"File listed in CODEBASE.md but missing: {f}")
                all_ok = False
    return all_ok

def main():
    parser = argparse.ArgumentParser(
        description="Dependency and structure audit with optional strict security mode."
    )
    parser.add_argument(
        "--strict-security",
        action="store_true",
        help="Fail the script when dependency vulnerabilities are detected.",
    )
    args = parser.parse_args()
    strict_security = args.strict_security or os.getenv("MAESTRO_AUDIT_FAIL_ON_VULN", "").strip() in (
        "1",
        "true",
        "TRUE",
        "yes",
        "YES",
    )

    print_header("MAESTRO DEPENDENCY & STRUCTURE AUDITOR (v2.3.1)")
    if strict_security:
        print_info("Strict security mode: ENABLED (vulnerability findings will fail).")
    
    success = True
    # 1. Structural Audit
    success &= audit_structure()
    
    # 2. Dependency Audit
    print("\n")
    success &= audit_nodejs(strict_security)
    success &= audit_python(strict_security)
    success &= audit_go()
    
    if success:
        print_success("\nAll audits completed successfully.")
        sys.exit(0)
    else:
        print_fail("\nAudits found inconsistencies or security risks.")
        sys.exit(1)

if __name__ == "__main__":
    main()
