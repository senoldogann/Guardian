---
name: init-project
description: Initialize the current project with the standard 'guncel-kurallar' structure from Desktop.
---

# Project Initialization Skill

This skill copies the standard agent structure from the central repository to the current working directory.

## Actions
1. Check if `.agent` folder exists. If so, ask for confirmation to overwrite.
2. Copy contents from `/Users/dogan/Desktop/güncel-kurallar/` to the current directory.
3. Ensure hidden files (like `.agent`, `.opencode`) are copied correctly.
