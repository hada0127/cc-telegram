#!/bin/bash
# Auto commit and push script for Claude Code hooks

# Add all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Get list of changed files for commit message
CHANGED_FILES=$(git diff --cached --name-only)
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)

# Determine commit type based on changed files
if echo "$CHANGED_FILES" | grep -q "^tests/\|\.test\.\|\.spec\."; then
    TYPE="test"
elif echo "$CHANGED_FILES" | grep -q "^docs/\|README\|\.md$"; then
    TYPE="docs"
elif echo "$CHANGED_FILES" | grep -q "package\.json\|package-lock\.json"; then
    TYPE="chore"
elif echo "$CHANGED_FILES" | grep -q "\.claude/"; then
    TYPE="config"
else
    TYPE="feat"
fi

# Generate commit message
if [ "$FILE_COUNT" -eq 1 ]; then
    FILE_NAME=$(basename "$CHANGED_FILES")
    MESSAGE="$TYPE: update $FILE_NAME"
else
    FIRST_FILES=$(echo "$CHANGED_FILES" | head -3 | xargs -I {} basename {} | tr '\n' ', ' | sed 's/,$//')
    if [ "$FILE_COUNT" -gt 3 ]; then
        MESSAGE="$TYPE: update $FIRST_FILES and $((FILE_COUNT - 3)) more files"
    else
        MESSAGE="$TYPE: update $FIRST_FILES"
    fi
fi

# Commit and push
git commit -m "$MESSAGE"
git push origin HEAD
