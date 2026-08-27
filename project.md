# Project Overview

E-pub CUP Validator: browser-only tool for e-pub production teams to check XHTML content files against text-quality rules before packaging. User uploads `.xhtml` file, picks which rules run, gets grouped pass/fail report with line/column locations and highlighted snippets. Pure client-side (no server, no build step) — parses raw text into DOM + line/text-mask structures, runs configurable rule functions over visible text only (ignores markup), renders results as collapsible rule groups. Aimed at non-technical editors: report language avoids jargon ("A dot is not followed by a space" not "regex mismatch").

# Architecture

Load order (index.html tail): `config.js` → `parser.js` → `rules.js` → `validator.js` → `reporter.js` → `app.js`. Each file attaches one global (`window.X`); later files depend on earlier globals existing. No modules/bundler.

Data flow: user selects file (app.js `handleFileSelect`) → click Validate → `readFileAsText` → `window.Validator.run(rawText, ruleState)` → internally calls `XhtmlParser.parse` then `runRule` per active rule from `rules.js` → returns report object → `window.Reporter.render(report)` paints stats + grouped issue tables into step-3 DOM.

# File Breakdown

**index.html** — Markup shell: 3-step panel structure (`data-step="1|2|3"`), stepper sidebar, upload box, rules list container, results stat cards + filter tabs + result list. Loads scripts in dependency order.

**config.js** — Defines `window.RULES_CONFIG`: array of `{id, name, description, enabled, severity}` — single source of truth for rule metadata and default enabled state.

**parser.js** — `window.XhtmlParser.parse(rawText)`: splits raw text into lines, builds per-line boolean `textMask` (true = char outside any tag, i.e. visible text) via a simple `<`/`>` scan, and attempts `DOMParser` XML parse capturing `parseError`. Returns `{raw, lines, textMask, dom, parseError}`.

**rules.js** — Rule implementations + dispatch.
- `isInsideEntity(line, col)` — checks if char at col sits inside an `&...;` HTML entity (named/decimal/hex), so entities aren't flagged as spacing errors.
- `window.RULES['multi-space'](parsed)` — flags runs of 2+ spaces and tab chars in visible text.
- `window.RULES['invalid-char-spacing'](parsed)` — flags digit-directly-followed-by-letter, lowercase-directly-followed-by-uppercase, and dot-not-followed-by-space (distinguishing decimal numbers as `warn`).
- `window.runRule(ruleId, parsed, enabled)` — looks up config + fn, runs it, stamps each result with `severity` (issue's own or config default) and `ruleName`.

**validator.js** — `window.Validator.run(rawText, ruleState)`: parses text, filters `RULES_CONFIG` by `ruleState` overrides (falling back to config `enabled`), runs `runRule` per active rule, aggregates issues. Returns report `{parsed, activeRules, issues, issueCount}`.

**reporter.js** — `window.Reporter`: stateful renderer (`currentReport`, `currentFilter`).
- `render(report)` — resets filter to 'all', renders stats + list.
- `setFilter(filter)` — updates tab UI classes, re-renders list.
- `_renderStats(report)` — fills rules/issues/lines stat cards.
- `_renderList()` — groups issues by ruleId, applies current filter (all/issues/passed), builds empty-state or group elements.
- `_buildGroup(group)` — builds one collapsible rule-group: header (name, count badge, severity tag) + body (pass message or issue table).
- `_explainIssue(issue)` — maps raw rule messages to plain-language explanations.
- `_stripTagsWithOffset(lineText, col)` — strips `<...>` tags from a line while recomputing the issue's column offset into the cleaned text.
- `_buildSnippet(lineText, col, length)` — builds "...before ·· after..." context snippet around the issue.
- `_escape(str)` — HTML-escapes via textContent round-trip.

**app.js** — IIFE controller wiring everything together.
- `ruleState` — in-memory toggle state seeded from `RULES_CONFIG.enabled`, never persisted back.
- `goToStep(n)` — toggles active step panel + stepper item classes.
- `formatSize(bytes)` — human-readable file size.
- `handleFileSelect(e)` — validates `.xhtml` extension, renders file card or error, enables/disables Next button.
- `renderRulesList()` — draws step-2 rule toggle list from `RULES_CONFIG` + `ruleState`, wires toggle clicks.
- `readFileAsText(file)` — Promise wrapper around `FileReader.readAsText`.
- `handleValidate()` — reads file, runs `Validator.run`, hands report to `Reporter.render`, advances to step 3.
- Bottom: event wiring for nav buttons and filter tabs; initial `goToStep(1)`.

# Rules System

`RULES_CONFIG` (config.js) is the registry: rule id, display name, description, default enabled, severity. `window.RULES` (rules.js) maps the same ids to the actual detection functions `(parsed) => issue[]`. `window.runRule(ruleId, parsed, enabled)` is the only entry point that runs a rule: it looks up config by id, bails if missing/disabled, calls `RULES[ruleId](parsed)`, then stamps `severity` (from issue if set, else config default) and `ruleName` onto every returned issue.

**To add a new rule:**
1. Add entry to `window.RULES_CONFIG` in config.js: unique `id`, `name`, `description`, `enabled`, `severity`.
2. Add `window.RULES['your-id'] = function(parsed) {...}` in rules.js, returning array of `{ruleId, line, col, length, message, detail}` (severity optional per-issue override).
3. Use `parsed.lines` and `parsed.textMask` to scan only visible text; use `isInsideEntity` if entity chars could false-positive.
4. Nothing else changes — `Validator.run` and `Reporter` iterate `RULES_CONFIG`/`activeRules` generically.
5. Optionally add id-specific plain-language cases to `Reporter._explainIssue`.

# Data Structures

**parsed** (from `XhtmlParser.parse`):
```
{
  raw: string,          // original file text
  lines: string[],       // split by \r\n|\r|\n
  textMask: boolean[][], // per-line, per-char: true = outside any tag
  dom: Document|null,     // DOMParser result (application/xhtml+xml)
  parseError: string|null // parsererror text or exception message
}
```

**issue** (returned by rule fns, enriched by `runRule`):
```
{
  ruleId: string,
  line: number,      // 1-based
  col: number,       // 1-based
  length: number,    // char span of the issue
  message: string,
  detail: string,    // snippet for debugging/tooltip
  severity: 'error'|'warn',
  ruleName: string   // added by runRule
}
```

**report** (from `Validator.run`):
```
{
  parsed: <parsed object>,
  activeRules: RuleConfig[],  // filtered RULES_CONFIG entries
  issues: issue[],
  issueCount: number
}
```

# UI / Stepper Flow

**Step 1 (Upload)** — `#uploadBox` label + hidden `#fileInput`. On file select, `handleFileSelect` validates extension, swaps upload box for `.file-card` (name/size/Change button) in `#fileName`, enables `#btnToStep2`. Change button resets state.

**Step 2 (Rules)** — `#btnToStep2` triggers `renderRulesList()` (builds `#rulesList` from `RULES_CONFIG`/`ruleState`, wires `.toggle-switch` clicks) then `goToStep(2)`. `#btnBackTo1` returns to step 1. `#btnToStep3` (labeled "Validate") calls `handleValidate`.

**Step 3 (Results)** — `handleValidate` reads file text, runs validator, calls `Reporter.render`, advances step. Stat cards (`#statRules`, `#statIssues`, `#statLines`) show counts. `.filter-tab` buttons (`all`/`issues`/`passed`) call `Reporter.setFilter`. `#resultList` holds collapsible `.rule-group` elements (click header to expand/collapse), each with an `.issue-table` of what's-wrong / snippet / line·col. `#btnBackTo2` returns to step 2.

`goToStep(n)` (app.js) toggles `.step-panel.active` and stepper sidebar `.active`/`.done` classes for all three steps.

# CSS Design Tokens

All in `:root` (style.css):
- `--accent` / `--accent-hover` / `--accent-soft` — primary brand blue, its hover state, and light tint (buttons, active stepper, toggle-on).
- `--pass` / `--pass-soft` — green for passed rules/checkmarks.
- `--fail` / `--fail-soft` — red for error-severity issues.
- `--warn` / `--warn-soft` — amber for warn-severity issues.
- `--bg` — page background.
- `--surface` — card/panel background.
- `--border` — default border/divider color.
- `--text` / `--text-muted` — primary and secondary text color.
- `--font` — body font stack (DM Sans).
- `--font-mono` — monospace-ish stack for snippets (IBM Plex Sans, despite name).
- `--r-card` / `--r-btn` / `--r-pill` — border-radius scale for cards, buttons, pill shapes.

# How to Extend

**Add a rule** — see Rules System section above: config.js entry + rules.js function, nothing else.

**Add a UI step** — add `<li class="stepper-item" data-step="N">` in sidebar, add `<section class="step-panel" data-step="N">` in `.content`, add nav buttons, wire click handlers in app.js calling `goToStep(N)`, extend `els` lookup object with new element refs.

**Add a filter tab** — add `<button class="filter-tab" data-filter="yourFilter">` in `.filter-tabs`, handle `yourFilter` case in `Reporter._renderList()`'s filter branch (currently `all`/`issues`/`passed`), no other wiring needed since click handler already delegates via `dataset.filter` to `Reporter.setFilter`.
