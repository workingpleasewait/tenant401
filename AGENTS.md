---
type: Note
_organized: true
---

# AGENTS.md — Tolaria Vault

This is a [Tolaria](https://github.com/refactoringhq/tolaria) vault.

Keep this file focused on vault-specific conventions. For general Tolaria behavior, use the bundled Tolaria agent docs path provided by the app session context.

## Core conventions

- Notes are Markdown files.
- Use the first H1 as the note title.
- Store note type in the `type:` frontmatter field.
- Use wikilinks in body text and frontmatter fields to connect notes.
- Tolaria reads notes recursively from all folders and stores new notes in the vault root by default.
- Saved views live in `views/*.yml`.

## What agents should do

- Create and edit notes using the frontmatter and H1 conventions above.
- Update `AGENTS.md` only when the user asks for vault-level guidance changes.
