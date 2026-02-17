#!/usr/bin/env python3
"""
Memory Pruning Automation Script

Prunes agent memory and queue files to prevent context bloat.
Run periodically during long Loki Mode sessions.

Usage:
    python scripts/prune_memory.py [--dry-run] [--verbose]
"""

import os
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import argparse

# Configuration
LOKI_DIR = ".loki"
MEMORY_DIR = f"{LOKI_DIR}/memory"
QUEUE_DIR = f"{LOKI_DIR}/queue"
ARCHIVE_DIR = f"{LOKI_DIR}/archive"

# Pruning thresholds
EPISODIC_MAX_AGE_DAYS = 7
HANDOFF_MAX_AGE_DAYS = 1
COMPLETED_QUEUE_MAX_ITEMS = 100
CONTINUITY_MAX_ITEMS_PER_SECTION = 5


def get_file_age_days(filepath: str) -> int:
    """Get file age in days."""
    if not os.path.exists(filepath):
        return 0
    mtime = os.path.getmtime(filepath)
    age = datetime.now() - datetime.fromtimestamp(mtime)
    return age.days


def prune_episodic_memory(dry_run: bool, verbose: bool) -> int:
    """Remove episodic memory files older than threshold."""
    episodic_dir = f"{MEMORY_DIR}/episodic"
    if not os.path.exists(episodic_dir):
        return 0

    removed = 0
    for root, dirs, files in os.walk(episodic_dir):
        for file in files:
            if file.endswith(".json"):
                filepath = os.path.join(root, file)
                age = get_file_age_days(filepath)
                if age > EPISODIC_MAX_AGE_DAYS:
                    if verbose:
                        print(f"  Pruning episodic: {filepath} (age: {age} days)")
                    if not dry_run:
                        os.remove(filepath)
                    removed += 1
    return removed


def prune_handoffs(dry_run: bool, verbose: bool) -> int:
    """Remove acknowledged handoffs older than threshold."""
    handoffs_dir = f"{MEMORY_DIR}/handoffs"
    if not os.path.exists(handoffs_dir):
        return 0

    removed = 0
    for file in os.listdir(handoffs_dir):
        if file.endswith(".json"):
            filepath = os.path.join(handoffs_dir, file)
            age = get_file_age_days(filepath)

            # Check if acknowledged
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
                    if data.get("acknowledged_at") and age > HANDOFF_MAX_AGE_DAYS:
                        if verbose:
                            print(f"  Pruning handoff: {filepath}")
                        if not dry_run:
                            os.remove(filepath)
                        removed += 1
            except (json.JSONDecodeError, IOError):
                pass
    return removed


def archive_completed_queue(dry_run: bool, verbose: bool) -> int:
    """Archive completed queue if it exceeds threshold."""
    completed_file = f"{QUEUE_DIR}/completed.json"
    if not os.path.exists(completed_file):
        return 0

    try:
        with open(completed_file, "r") as f:
            completed = json.load(f)
    except (json.JSONDecodeError, IOError):
        return 0

    if not isinstance(completed, list) or len(completed) <= COMPLETED_QUEUE_MAX_ITEMS:
        return 0

    # Archive to dated file
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    archive_file = f"{ARCHIVE_DIR}/completed-{datetime.now().strftime('%Y-%m-%d')}.json"

    if verbose:
        print(f"  Archiving {len(completed)} completed tasks to {archive_file}")

    if not dry_run:
        # Append to existing archive or create new
        existing = []
        if os.path.exists(archive_file):
            with open(archive_file, "r") as f:
                existing = json.load(f)

        with open(archive_file, "w") as f:
            json.dump(existing + completed, f, indent=2)

        # Clear completed queue
        with open(completed_file, "w") as f:
            json.dump([], f)

    return len(completed)


def prune_continuity_sections(dry_run: bool, verbose: bool) -> int:
    """Prune CONTINUITY.md sections to max items."""
    continuity_file = f"{LOKI_DIR}/CONTINUITY.md"
    if not os.path.exists(continuity_file):
        return 0

    try:
        with open(continuity_file, "r") as f:
            content = f.read()
    except IOError:
        return 0

    # Sections to prune
    sections_to_prune = [
        "## Just Completed",
        "## Key Decisions This Session",
    ]

    pruned = 0
    lines = content.split("\n")
    new_lines = []
    in_prune_section = False
    item_count = 0

    for line in lines:
        # Check if entering a prune section
        if any(line.startswith(section) for section in sections_to_prune):
            in_prune_section = True
            item_count = 0
            new_lines.append(line)
            continue

        # Check if leaving section (new section starts)
        if in_prune_section and line.startswith("## "):
            in_prune_section = False

        # In prune section, count items (lines starting with - or *)
        if in_prune_section and line.strip().startswith(("-", "*", "|")):
            item_count += 1
            if item_count > CONTINUITY_MAX_ITEMS_PER_SECTION:
                pruned += 1
                continue

        new_lines.append(line)

    if pruned > 0:
        if verbose:
            print(f"  Pruning {pruned} items from CONTINUITY.md sections")
        if not dry_run:
            with open(continuity_file, "w") as f:
                f.write("\n".join(new_lines))

    return pruned


def prune_dead_letter_queue(dry_run: bool, verbose: bool) -> int:
    """Remove dead letter items older than 7 days."""
    dlq_file = f"{QUEUE_DIR}/dead-letter.json"
    if not os.path.exists(dlq_file):
        return 0

    try:
        with open(dlq_file, "r") as f:
            dlq = json.load(f)
    except (json.JSONDecodeError, IOError):
        return 0

    if not isinstance(dlq, list):
        return 0

    cutoff = datetime.now() - timedelta(days=7)
    original_count = len(dlq)

    # Filter out old items
    new_dlq = []
    for item in dlq:
        created_at = item.get("createdAt", "")
        try:
            item_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            if item_date.replace(tzinfo=None) > cutoff:
                new_dlq.append(item)
        except (ValueError, TypeError):
            new_dlq.append(item)  # Keep items with unparseable dates

    removed = original_count - len(new_dlq)

    if removed > 0:
        if verbose:
            print(f"  Pruning {removed} old items from dead-letter queue")
        if not dry_run:
            with open(dlq_file, "w") as f:
                json.dump(new_dlq, f, indent=2)

    return removed


def main():
    parser = argparse.ArgumentParser(description="Prune agent memory and queue files")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be pruned without actually removing",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    if not os.path.exists(LOKI_DIR):
        print(f"No {LOKI_DIR} directory found. Nothing to prune.")
        return

    if args.dry_run:
        print("DRY RUN - No files will be modified\n")

    print("Memory Pruning Report")
    print("=" * 40)

    # Run all pruning operations
    episodic = prune_episodic_memory(args.dry_run, args.verbose)
    print(f"Episodic memory files removed: {episodic}")

    handoffs = prune_handoffs(args.dry_run, args.verbose)
    print(f"Acknowledged handoffs removed: {handoffs}")

    archived = archive_completed_queue(args.dry_run, args.verbose)
    print(f"Completed tasks archived: {archived}")

    continuity = prune_continuity_sections(args.dry_run, args.verbose)
    print(f"CONTINUITY.md items pruned: {continuity}")

    dlq = prune_dead_letter_queue(args.dry_run, args.verbose)
    print(f"Dead-letter items removed: {dlq}")

    print("=" * 40)
    total = episodic + handoffs + archived + continuity + dlq
    print(f"Total items processed: {total}")

    if args.dry_run:
        print("\nRun without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
