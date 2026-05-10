# Obsidian Calendar Editor

A desktop application for creating and managing calendar events for Obsidian Full Calendar plugin.
![Look](image.png)
## Features

- Create, edit, and delete calendar events
- Month, week, day, and list view modes
- Recurring events support (daily, weekly, monthly)
- Import events from your system calendar
- Creates `.md` files with YAML frontmatter compatible with Obsidian Full Calendar

## Requirements

- Obsidian vault with [Full Calendar](https://github.com/obsidian-community/obsidian-full-calendar) plugin installed

## Setup

1. Download the latest release for your platform from the releases page
2. Extract and run the application

## Configuration

1. Open Settings (gear icon)
2. Set the path to your Obsidian vault's events folder (e.g., `~/Documents/Obsidian Vault/obsidian/Events`)
3. The app will read and write `.md` files in this folder

## Event File Format

Events are stored as markdown files with YAML frontmatter:

```yaml
---
title: Meeting
allDay: false
startTime: 14:00
endTime: 15:00
date: 2026-05-15
completed: null
recurringType: weekly
recurringInterval: 1
recurringMaterializeCount: 52
---
#event
```

## Using with Obsidian

1. Configure Full Calendar in Obsidian to use the same folder
2. The editor and Obsidian will both read/write to the same `.md` files
3. Changes sync automatically

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run start

# Build
bun run make
```