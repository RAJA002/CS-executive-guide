# CS Executive Module 2 — Study Guide

A static study guide for ICSI CS Executive Programme, Group 2:
- Paper 5 — Capital Market & Securities Laws
- Paper 6 — Economic, Commercial & Intellectual Property Laws
- Paper 7 — Tax Laws & Practice

## Features
- Lesson-by-lesson notes, organised by official ICSI part-wise marks weightage
- Progress tracker (Not started / Studying / Revised / Weak) — saved in your browser only
- Weak-topics list on the dashboard for quick revision
- Built-in AI study bot (Groq API) — answers questions about any subject

## Publishing on GitHub Pages
1. Create a new GitHub repo and push these files to it (keep the folder structure as-is).
2. In the repo: **Settings → Pages → Source** → select the `main` branch, root folder.
3. Wait a minute, then your site is live at `https://<your-username>.github.io/<repo-name>/`.

## Using the AI bot
Click the round **AI** button (bottom right). The first time, it asks for a Groq API key —
get a free one at [console.groq.com/keys](https://console.groq.com/keys) (no card required).

**Your key is stored only in your own browser** (localStorage) — it is never written into
any file here, never committed to the repo, and never visible to anyone else who might open
the published site. If you ever want to remove it, clear your browser's site data for this page.

## Editing content
- `assets/data.js` — all lesson titles, marks weightage, and notes. Edit or expand any lesson's
  `notes` field directly.
- `assets/style.css` — colors, type, layout.
- `assets/app.js` — progress tracking and page rendering logic.
- `assets/bot.js` — the AI bot widget and Groq API calls.

## Notes on accuracy
The bot answers from general model knowledge, not a live legal database — always cross-check
anything exam-critical (exact section numbers, recent amendments) against your official ICSI
study material.
