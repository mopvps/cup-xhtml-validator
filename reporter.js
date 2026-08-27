// Renders validator report into DOM. No technical jargon.
window.Reporter = {
  currentReport: null,
  currentFilter: 'all',

  render(report) {
    this.currentReport = report;
    this.currentFilter = 'all';
    this._renderStats(report);
    this._renderList();
  },

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this._renderList();
  },

  _renderStats(report) {
    document.getElementById('statRules').textContent = report.activeRules.length;

    const issuesEl = document.getElementById('statIssues');
    issuesEl.textContent = report.issueCount;
    issuesEl.style.color = report.issueCount > 0 ? 'var(--fail)' : 'var(--pass)';

    const linesEl = document.getElementById('statLines');
    linesEl.textContent = report.parsed.lines.length;
    linesEl.style.color = 'var(--text)';
  },

  _renderList() {
    const list = document.getElementById('resultList');
    list.innerHTML = '';
    const report = this.currentReport;
    if (!report) return;

    // Group issues by ruleId
    const groupsByRule = {};
    for (const issue of report.issues) {
      if (!groupsByRule[issue.ruleId]) groupsByRule[issue.ruleId] = [];
      groupsByRule[issue.ruleId].push(issue);
    }

    const groups = report.activeRules.map(rule => {
      const ruleIssues = groupsByRule[rule.id] || [];
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        issues: ruleIssues,
        passed: ruleIssues.length === 0
      };
    });

    let groupsToShow = groups;
    if (this.currentFilter === 'issues') {
      groupsToShow = groups.filter(g => !g.passed);
    } else if (this.currentFilter === 'passed') {
      groupsToShow = groups.filter(g => g.passed);
    }

    if (groupsToShow.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = this.currentFilter === 'issues'
        ? 'No issues found. Nice and clean.'
        : 'Nothing to show for this filter.';
      list.appendChild(empty);
      return;
    }

    for (const group of groupsToShow) {
      list.appendChild(this._buildGroup(group));
    }
  },

  _buildGroup(group) {
    const wrap = document.createElement('div');
    wrap.className = 'rule-group ' + (group.passed ? 'group-pass' : 'group-' + group.severity);

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'rule-group-header';

    const countBadge = group.passed
      ? `<span class="count-badge count-pass">Passed</span>`
      : `<span class="count-badge count-${group.severity}">${group.issues.length} issue${group.issues.length === 1 ? '' : 's'}</span>`;

    const severityLabel = group.passed ? 'PASS' : group.severity.toUpperCase();

    header.innerHTML = `
      <span class="group-arrow">▶</span>
      <span class="group-rule-name">${this._escape(group.ruleName)}</span>
      <span class="group-center">${countBadge}</span>
      <span class="group-severity severity-tag-${group.passed ? 'pass' : group.severity}">${severityLabel}</span>
    `;

    const body = document.createElement('div');
    body.className = 'rule-group-body';

    const inner = document.createElement('div');
    inner.className = 'rule-group-body-inner';

    if (group.passed) {
      const row = document.createElement('div');
      row.className = 'group-issue-row row-pass';
      row.textContent = 'All checks passed for this rule.';
      inner.appendChild(row);
    } else {
      if (group.ruleId === 'duplicate-id') {
        group.issues.forEach(issue => {
          const row = document.createElement('div');
          row.className = 'group-issue-row';
          const lineNums = issue.detail.split(', ');
          const lineLinks = lineNums.map((l, idx) =>
            idx === 0
              ? `Line: ${this._escape(l)}`
              : `Col: ${this._escape(l)}`
          ).join(' | ');
          row.innerHTML = `
            <span style="font-weight:600;font-family:var(--font-mono)">${this._escape(issue.message)}</span>
            <span style="color:var(--text-muted);margin-left:12px">${lineLinks}</span>
          `;
          inner.appendChild(row);
        });
      } else if (group.ruleId === 'pagebreak-sequence') {
        // Collect all pagebreaks from raw lines
        const allPages = [];
        const errorLines = new Set(group.issues.map(i => i.line));
        const regex = /id="page_([^"]+)"/;
        this.currentReport.parsed.lines.forEach((line, i) => {
          if (!line.includes('pagebreak')) return;
          const match = line.match(regex);
          if (!match) return;
          allPages.push({ num: match[1], line: i + 1, isError: errorLines.has(i + 1) });
        });

        // Render circles
        const wrap2 = document.createElement('div');
        wrap2.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:12px 16px;';
        allPages.forEach(page => {
          const circle = document.createElement('div');
          circle.title = `Line ${page.line}`;
          circle.style.cssText = `
            width:40px;height:40px;border-radius:50%;
            background:${page.isError ? 'var(--fail)' : 'var(--pass)'};
            color:#fff;display:flex;align-items:center;
            justify-content:center;font-weight:700;font-size:12px;
            flex-shrink:0;cursor:default;
            title="Line ${page.line}";
          `;
          circle.textContent = page.num;
          circle.title = `Page ${page.num} — Line ${page.line}`;
          wrap2.appendChild(circle);
        });
        inner.appendChild(wrap2);

        // Show error messages below
        if (group.issues.length > 0) {
          group.issues.forEach(issue => {
            const msg = document.createElement('div');
            msg.style.cssText = 'padding:6px 16px;font-size:12px;color:var(--fail);';
            msg.textContent = issue.message;
            inner.appendChild(msg);
          });
        }
      } else if (group.ruleId === 'file-size') {
        group.issues.forEach(issue => {
          const row = document.createElement('div');
          row.className = 'group-issue-row';
          row.innerHTML = `
            <span style="font-weight:600">${this._escape(this._explainIssue(issue))}</span>
          `;
          inner.appendChild(row);
        });
      } else if (group.ruleId === 'li-span-between') {
        const lines = this.currentReport.parsed.lines;
        group.issues.forEach(issue => {
          const wrap = document.createElement('div');
          wrap.className = 'group-issue-row';
          wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px 16px;';

          // 1. Explanation
          const explain = document.createElement('div');
          explain.style.cssText = 'font-weight:600;color:var(--fail);';
          explain.textContent = 'A span tag was found outside a <li> inside a list — it should be removed or moved inside a list item';
          wrap.appendChild(explain);

          // 2. Code block context
          const prevLine = lines[issue.line - 2] || '';
          const currLine = lines[issue.line - 1] || '';
          const nextLine = lines[issue.line] || '';

          const block = document.createElement('div');
          block.style.cssText = 'font-family:var(--font-mono);font-size:13px;display:flex;flex-direction:column;gap:2px;border-radius:var(--r-card);overflow:hidden;';

          const prev = document.createElement('div');
          prev.style.cssText = 'color:var(--text-muted);white-space:pre;padding:2px 10px;';
          prev.textContent = prevLine.trim();

          const curr = document.createElement('div');
          curr.style.cssText = 'background:var(--fail-soft);color:var(--fail);padding:2px 10px;border-left:3px solid var(--fail);white-space:pre;font-weight:600;';
          curr.textContent = currLine.trim();

          const next = document.createElement('div');
          next.style.cssText = 'color:var(--text-muted);white-space:pre;padding:2px 10px;';
          next.textContent = nextLine.trim();

          block.appendChild(prev);
          block.appendChild(curr);
          block.appendChild(next);
          wrap.appendChild(block);

          // 3. Line number
          const loc = document.createElement('div');
          loc.style.cssText = 'font-size:12px;color:var(--text-muted);';
          loc.textContent = `Line ${issue.line}`;
          wrap.appendChild(loc);

          inner.appendChild(wrap);
        });
      } else if (group.ruleId === 'unlinked-reference') {
        group.issues.forEach(issue => {
          const row = document.createElement('div');
          row.className = 'group-issue-row';
          row.style.cssText = 'display:flex;align-items:center;gap:16px;padding:10px 16px;';

          // Explanation
          const explain = document.createElement('div');
          explain.style.cssText = 'flex:2;font-weight:600;color:var(--warn);';
          explain.textContent = `"${issue.detail.replace('Found: ', '')}" is not wrapped in an anchor tag`;
          row.appendChild(explain);

          // Highlighted reference text
          const tag = document.createElement('span');
          tag.style.cssText = 'flex:1;background:var(--warn-soft);color:var(--warn);padding:2px 8px;border-radius:var(--r-pill);font-family:var(--font-mono);font-size:13px;font-weight:600;text-align:center;';
          tag.textContent = issue.detail.replace('Found: ', '');
          row.appendChild(tag);

          // Line and col
          const loc = document.createElement('div');
          loc.style.cssText = 'flex:1;font-size:12px;color:var(--text-muted);text-align:right;';
          loc.textContent = `Line ${issue.line} · Col ${issue.col}`;
          row.appendChild(loc);

          inner.appendChild(row);
        });
      } else {
        const lines = this.currentReport.parsed.lines;
        const table = document.createElement('table');
        table.className = 'issue-table';
        table.innerHTML = `
          <thead>
            <tr>
              <th class="col-whats-wrong">What's wrong</th>
              <th class="col-where">Where it is</th>
              <th class="col-location">Location</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        group.issues.forEach(issue => {
          const lineText = lines[issue.line - 1] || '';
          const { cleanLine, cleanCol } = this._stripTagsWithOffset(lineText, issue.col);
          const tr = document.createElement('tr');

          if (issue.ruleId === 'italic-paren-start') {
            tr.innerHTML = `
              <td class="col-whats-wrong">${this._escape(this._explainIssue(issue))}</td>
              <td class="col-where"><span class="snippet-text"><i>${this._escape(issue.detail)}</i></span></td>
              <td class="col-location">Line ${issue.line}</td>
            `;
          } else {
            tr.innerHTML = `
              <td class="col-whats-wrong">${this._escape(this._explainIssue(issue))}</td>
              <td class="col-where"><span class="snippet-text">${this._buildSnippet(cleanLine, cleanCol, issue.length || 1)}</span></td>
              <td class="col-location">Line ${issue.line} · Col ${issue.col}</td>
            `;
          }

          tbody.appendChild(tr);
        });
        inner.appendChild(table);
      }
    }

    body.appendChild(inner);

    header.addEventListener('click', () => {
      const expanded = wrap.classList.toggle('expanded');
      header.querySelector('.group-arrow').textContent = expanded ? '▼' : '▶';
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
  },

  _explainIssue(issue) {
    if (issue.ruleId === 'multi-space') {
      if (issue.message === 'Tab character found in text content') {
        return 'A tab character was found in the text';
      }
      if (issue.message === 'Space found immediately after tag opening') {
        return 'A space was found right after a tag opens — remove it';
      }
      if (issue.message === 'Space found immediately before tag closing') {
        return 'A space was found right before a tag closes — remove it';
      }
      return `${issue.length} spaces found instead of 1`;
    }

    if (issue.ruleId === 'invalid-char-spacing') {
      switch (issue.message) {
        case 'Number directly followed by letter without space':
          return 'A number runs directly into a word — add a space';
        case 'Lowercase letter directly followed by uppercase without space':
          return 'A lowercase letter runs into a capital — add a space';
        case 'Dot not followed by a space':
          return 'A dot is not followed by a space';
        case 'Decimal number — check if space is needed':
          return 'Decimal number found — verify if spacing is correct';
        default:
          return issue.message;
      }
    }

    if (issue.ruleId === 'paragraph-start-case') {
      return 'This block starts with a lowercase letter — it should begin with a capital';
    }

    if (issue.ruleId === 'duplicate-id') {
      return `Duplicate id ${issue.message} — found on lines: ${issue.detail}`;
    }

    if (issue.ruleId === 'pagebreak-sequence') {
      return issue.message;
    }

    if (issue.ruleId === 'italic-paren-start') {
      return issue.message;
    }

    if (issue.ruleId === 'raw-url')
      return `Raw URL found in text — "${issue.detail}" should be wrapped in an <a> tag or removed`;

    if (issue.ruleId === 'sup-sequence') {
      return issue.message;
    }

    if (issue.ruleId === 'raw-entity') {
      return issue.message;
    }

    if (issue.ruleId === 'encoded-entity') {
      return issue.message;
    }

    if (issue.ruleId === 'para-end-punctuation')
      return `This paragraph does not end with a period or semicolon — found ${issue.message.match(/'(.+)'/)?.[1] ?? 'unknown'} instead`;

    if (issue.ruleId === 'file-size')
      return `This file is too large. ${issue.detail}. Reduce file size below 300KB before packaging.`;

    if (issue.ruleId === 'li-span-between')
      return `A span tag was found between two list items — it should not appear outside a <li>`;

    if (issue.ruleId === 'unlinked-reference')
      return `"${issue.detail.replace('Found: ', '')}" appears as plain text — it should be wrapped in an <a> tag linking to the referenced item`;

    return issue.message;
  },

  _stripTagsWithOffset(lineText, col) {
    // Strip HTML tags, tracking how the 1-based col shifts in the cleaned text.
    // Entities (&amp; &#x00E1; etc.) are left untouched — only <...> tags are removed.
    const idx = Math.max(0, col - 1);
    let cleanLine = '';
    let cleanCol = 1;
    let inTag = false;

    for (let i = 0; i < lineText.length; i++) {
      const ch = lineText[i];
      if (ch === '<') {
        inTag = true;
        continue;
      }
      if (ch === '>') {
        inTag = false;
        continue;
      }
      if (!inTag) {
        if (i === idx) cleanCol = cleanLine.length + 1;
        cleanLine += ch;
      }
    }

    if (idx >= lineText.length) cleanCol = cleanLine.length + 1;

    return { cleanLine, cleanCol };
  },

  _buildSnippet(lineText, col, length) {
    const start = Math.max(0, col - 1);
    const end = Math.min(lineText.length, start + length);

    const beforeWords = lineText.slice(0, start).trim().split(/\s+/).filter(Boolean).slice(-10).join(' ');
    const afterWords = lineText.slice(end).trim().split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
    const highlighted = lineText.slice(start, end) || '·';

    const before = this._escape(beforeWords);
    const highlight = `<span class="error-highlight">${this._escape(highlighted)}</span>`;
    const after = this._escape(afterWords);

    const parts = [];
    if (before) parts.push(before);
    parts.push(highlight);
    if (after) parts.push(after);

    return `...${parts.join(' ')}...`;
  },

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }
};
