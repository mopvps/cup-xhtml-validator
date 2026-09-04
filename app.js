// Main controller: stepper nav, file handling, wires modules together
(function () {
  let currentStep = 1;
  let selectedFile = null;
  let fileText = null;

  // In-memory rule toggle state. Seeded from config.js defaults, never writes back to config.js.
  const ruleState = {};
  window.RULES_CONFIG.forEach(rule => { ruleState[rule.id] = rule.enabled; });

  let activeCategory = 'all';
  let searchQuery = '';
  let hasValidated = false;
  let lastIssueCount = 0;

  const els = {
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    uploadBox: document.getElementById('uploadBox'),
    fileDetailsArea: document.getElementById('fileDetailsArea'),
    btnToStep2: document.getElementById('btnToStep2'),
    btnToStep3: document.getElementById('btnToStep3'),
    btnDirectValidate: document.getElementById('btnDirectValidate'),
    btnLoadSample: document.getElementById('btnLoadSample'),
    btnToggleCodePreview: document.getElementById('btnToggleCodePreview'),
    codePreviewBody: document.getElementById('codePreviewBody'),
    codePreviewContent: document.getElementById('codePreviewContent'),
    codeLinesCount: document.getElementById('codeLinesCount'),
    recentFilesWrap: document.getElementById('recentFilesWrap'),
    recentFilesList: document.getElementById('recentFilesList'),
    btnBackTo1: document.getElementById('btnBackTo1'),
    btnBackTo2: document.getElementById('btnBackTo2'),
    rulesList: document.getElementById('rulesList'),
    rulesCategoryTabs: document.getElementById('rulesCategoryTabs'),
    ruleSearchInput: document.getElementById('ruleSearchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    btnEnableAll: document.getElementById('btnEnableAll'),
    btnDisableAll: document.getElementById('btnDisableAll'),
    sidebarStep1Sub: document.getElementById('sidebarStep1Sub'),
    sidebarStep2Sub: document.getElementById('sidebarStep2Sub'),
    sidebarStep3Sub: document.getElementById('sidebarStep3Sub'),
    steps: document.querySelectorAll('.step-panel'),
    stepperItems: document.querySelectorAll('.stepper-item')
  };

  // Drag & Drop event handlers on upload box
  if (els.uploadBox) {
    ['dragenter', 'dragover'].forEach(eventName => {
      els.uploadBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.uploadBox.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      els.uploadBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        els.uploadBox.classList.remove('drag-over');
      }, false);
    });

    els.uploadBox.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    });

    els.uploadBox.addEventListener('click', (e) => {
      if (e.target === els.fileInput || e.target.id === 'btnLoadSample') return;
      els.fileInput.click();
    });
  }

  // Code preview expand/collapse toggle
  if (els.btnToggleCodePreview) {
    els.btnToggleCodePreview.addEventListener('click', () => {
      const isExpanded = els.codePreviewBody.classList.toggle('expanded');
      const arrow = els.btnToggleCodePreview.querySelector('.code-toggle-arrow');
      if (arrow) arrow.textContent = isExpanded ? '▲' : '▼';
    });
  }

  // Direct Validation Button on Step 1
  if (els.btnDirectValidate) {
    els.btnDirectValidate.addEventListener('click', () => {
      handleValidate();
    });
  }

  function processFile(file) {
    if (!file) {
      resetFileSelection();
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xhtml')) {
      els.fileName.innerHTML = '<div class="file-error">Please select a valid .xhtml file.</div>';
      els.uploadBox.style.display = 'flex';
      if (els.fileDetailsArea) els.fileDetailsArea.style.display = 'none';
      if (els.btnToStep2) els.btnToStep2.disabled = true;
      selectedFile = null;
      updateSidebarStatus();
      return;
    }

    selectedFile = file;
    els.uploadBox.style.display = 'none';
    if (els.fileDetailsArea) els.fileDetailsArea.style.display = 'block';

    els.fileName.innerHTML = `
      <div class="file-card">
        <div class="file-card-icon">⎘</div>
        <div class="file-card-body">
          <div class="file-card-name">${file.name}</div>
          <div class="file-card-size">${formatSize(file.size)}</div>
        </div>
        <button type="button" id="btnChangeFile" class="btn btn-secondary btn-sm">Change File</button>
      </div>
    `;

    document.getElementById('btnChangeFile').addEventListener('click', () => {
      if (els.fileInput) els.fileInput.value = '';
      resetFileSelection();
    });

    if (els.btnToStep2) els.btnToStep2.disabled = false;

    // Read file for stats & code preview
    readFileAsText(file).then(text => {
      fileText = text;
      const lines = text.split(/\r?\n/);
      const lineCount = lines.length;

      // Update Quick Stats
      const elLines = document.getElementById('preStatLines');
      if (elLines) elLines.textContent = lineCount.toLocaleString();

      const elSize = document.getElementById('preStatSize');
      if (elSize) {
        const kb = (file.size / 1024).toFixed(1);
        elSize.textContent = `${kb} KB`;
        elSize.style.color = file.size > 300 * 1024 ? 'var(--fail)' : 'var(--pass)';
      }

      const elStatus = document.getElementById('preStatStatus');
      if (elStatus) elStatus.textContent = 'Ready to Audit';

      // Update Code Preview
      if (els.codeLinesCount) els.codeLinesCount.textContent = `${lineCount} lines`;
      if (els.codePreviewContent) {
        const previewLines = lines.slice(0, 60).map((l, idx) => {
          const num = String(idx + 1).padStart(3, ' ');
          return `<span class="code-line-num">${num}</span>  ${escapeHtml(l)}`;
        }).join('\n');

        els.codePreviewContent.innerHTML = previewLines + (lines.length > 60 ? `\n... (${lines.length - 60} more lines hidden in preview)` : '');
      }

      saveRecentFile(file.name, file.size);
      updateSidebarStatus();
    }).catch(err => {
      console.error('Error reading file preview:', err);
    });
  }

  function resetFileSelection() {
    selectedFile = null;
    fileText = null;
    if (els.fileName) els.fileName.innerHTML = '';
    if (els.uploadBox) els.uploadBox.style.display = 'flex';
    if (els.fileDetailsArea) els.fileDetailsArea.style.display = 'none';
    if (els.btnToStep2) els.btnToStep2.disabled = true;
    updateSidebarStatus();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function saveRecentFile(name, size) {
    try {
      let recent = JSON.parse(localStorage.getItem('epub_validator_recent') || '[]');
      recent = recent.filter(item => item.name !== name);
      recent.unshift({ name, size, date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      if (recent.length > 3) recent = recent.slice(0, 3);
      localStorage.setItem('epub_validator_recent', JSON.stringify(recent));
      renderRecentFiles();
    } catch (e) {
      console.warn('LocalStorage unavailable for recent files', e);
    }
  }

  function renderRecentFiles() {
    if (!els.recentFilesWrap || !els.recentFilesList) return;
    try {
      const recent = JSON.parse(localStorage.getItem('epub_validator_recent') || '[]');
      if (recent.length === 0) {
        els.recentFilesWrap.style.display = 'none';
        return;
      }
      els.recentFilesWrap.style.display = 'block';
      els.recentFilesList.innerHTML = '';

      recent.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'recent-file-chip';
        chip.innerHTML = `📄 ${item.name} <span class="recent-file-meta">(${formatSize(item.size)})</span>`;
        els.recentFilesList.appendChild(chip);
      });
    } catch (e) {
      els.recentFilesWrap.style.display = 'none';
    }
  }

  renderRecentFiles();

  function updateSidebarStatus() {
    // Step 1 status
    if (els.sidebarStep1Sub) {
      if (selectedFile) {
        els.sidebarStep1Sub.textContent = `${selectedFile.name} (${formatSize(selectedFile.size)})`;
      } else {
        els.sidebarStep1Sub.textContent = 'Choose your XHTML file';
      }
    }

    // Step 2 status
    if (els.sidebarStep2Sub) {
      const activeCount = window.RULES_CONFIG.filter(r => ruleState[r.id]).length;
      const totalCount = window.RULES_CONFIG.length;
      els.sidebarStep2Sub.textContent = `${activeCount} of ${totalCount} checks active`;
    }

    // Step 3 status
    if (els.sidebarStep3Sub) {
      if (hasValidated) {
        if (lastIssueCount === 0) {
          els.sidebarStep3Sub.textContent = 'All checks passed ✓';
        } else {
          els.sidebarStep3Sub.textContent = `${lastIssueCount} issue${lastIssueCount === 1 ? '' : 's'} found`;
        }
      } else {
        els.sidebarStep3Sub.textContent = 'See the report';
      }
    }

    // Interactive stepper accessibility
    els.stepperItems.forEach(item => {
      const stepNum = Number(item.dataset.step);
      let isNavigable = false;
      if (stepNum === 1) isNavigable = true;
      if (stepNum === 2 && selectedFile) isNavigable = true;
      if (stepNum === 3 && hasValidated) isNavigable = true;

      item.classList.toggle('navigable', isNavigable);
    });
  }

  function goToStep(n) {
    currentStep = n;
    els.steps.forEach(panel => {
      panel.classList.toggle('active', Number(panel.dataset.step) === n);
    });
    els.stepperItems.forEach(item => {
      const s = Number(item.dataset.step);
      item.classList.toggle('active', s === n);
      item.classList.toggle('done', s < n);
    });
    updateSidebarStatus();
  }

  // Sidebar item click handlers
  els.stepperItems.forEach(item => {
    item.addEventListener('click', () => {
      const stepNum = Number(item.dataset.step);
      if (stepNum === 1) {
        goToStep(1);
      } else if (stepNum === 2 && selectedFile) {
        renderCategoryTabs();
        renderRulesList();
        goToStep(2);
      } else if (stepNum === 3 && hasValidated) {
        goToStep(3);
      }
    });
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }

  function getCategories() {
    const cats = ['all'];
    window.RULES_CONFIG.forEach(r => {
      if (r.category && !cats.includes(r.category)) {
        cats.push(r.category);
      }
    });
    return cats;
  }

  function renderCategoryTabs() {
    if (!els.rulesCategoryTabs) return;
    const categories = getCategories();
    els.rulesCategoryTabs.innerHTML = '';

    categories.forEach(cat => {
      let count = 0;
      if (cat === 'all') {
        count = window.RULES_CONFIG.length;
      } else {
        count = window.RULES_CONFIG.filter(r => r.category === cat).length;
      }

      const label = cat === 'all' ? 'All Rules' : cat;
      const tab = document.createElement('button');
      tab.className = `rule-cat-tab ${activeCategory === cat ? 'active' : ''}`;
      tab.dataset.cat = cat;
      tab.innerHTML = `${label} <span class="rule-cat-count">${count}</span>`;

      tab.addEventListener('click', () => {
        activeCategory = cat;
        renderCategoryTabs();
        renderRulesList();
      });

      els.rulesCategoryTabs.appendChild(tab);
    });
  }

  function renderRulesList() {
    if (!els.rulesList) return;
    els.rulesList.innerHTML = '';

    const query = searchQuery.trim().toLowerCase();
    const filteredRules = window.RULES_CONFIG.filter(rule => {
      const matchCategory = activeCategory === 'all' || rule.category === activeCategory;
      const matchSearch = !query ||
        rule.name.toLowerCase().includes(query) ||
        rule.description.toLowerCase().includes(query) ||
        (rule.category && rule.category.toLowerCase().includes(query));
      return matchCategory && matchSearch;
    });

    if (filteredRules.length === 0) {
      els.rulesList.innerHTML = `
        <div class="rules-empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No matching rules found</div>
          <div class="empty-desc">Try tweaking your search term or selecting a different category.</div>
          <button id="btnResetRuleFilters" class="btn btn-secondary btn-sm" style="margin-top: 12px;">Clear Filters</button>
        </div>
      `;
      const btnReset = document.getElementById('btnResetRuleFilters');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          searchQuery = '';
          activeCategory = 'all';
          if (els.ruleSearchInput) els.ruleSearchInput.value = '';
          if (els.btnClearSearch) els.btnClearSearch.style.display = 'none';
          renderCategoryTabs();
          renderRulesList();
        });
      }
      return;
    }

    filteredRules.forEach(rule => {
      const on = ruleState[rule.id];
      const card = document.createElement('div');
      card.className = 'rule-card ' + (on ? 'rule-enabled' : 'rule-disabled');
      card.dataset.ruleId = rule.id;

      card.innerHTML = `
        <div class="rule-card-header">
          <div class="rule-card-badges">
            <span class="rule-category-badge">${rule.category || 'General'}</span>
            <span class="rule-severity severity-${rule.severity}">${rule.severity}</span>
          </div>
          <button class="toggle-switch ${on ? 'on' : ''}" data-rule-id="${rule.id}" role="switch" aria-checked="${on}" aria-label="Toggle ${rule.name}"></button>
        </div>
        <div class="rule-card-body">
          <div class="rule-name">${rule.name}</div>
          <div class="rule-desc">${rule.description}</div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('toggle-switch')) return;
        toggleRule(rule.id);
      });

      const switchBtn = card.querySelector('.toggle-switch');
      switchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRule(rule.id);
      });

      els.rulesList.appendChild(card);
    });
  }

  function toggleRule(ruleId) {
    ruleState[ruleId] = !ruleState[ruleId];
    renderRulesList();
    updateSidebarStatus();
  }

  function setAllRulesState(enabled) {
    const query = searchQuery.trim().toLowerCase();
    window.RULES_CONFIG.forEach(rule => {
      const matchCategory = activeCategory === 'all' || rule.category === activeCategory;
      const matchSearch = !query ||
        rule.name.toLowerCase().includes(query) ||
        rule.description.toLowerCase().includes(query) ||
        (rule.category && rule.category.toLowerCase().includes(query));

      if (matchCategory && matchSearch) {
        ruleState[rule.id] = enabled;
      }
    });
    renderRulesList();
    updateSidebarStatus();
  }

  if (els.ruleSearchInput) {
    els.ruleSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (els.btnClearSearch) {
        els.btnClearSearch.style.display = searchQuery ? 'block' : 'none';
      }
      renderRulesList();
    });
  }

  if (els.btnClearSearch) {
    els.btnClearSearch.addEventListener('click', () => {
      searchQuery = '';
      if (els.ruleSearchInput) els.ruleSearchInput.value = '';
      els.btnClearSearch.style.display = 'none';
      renderRulesList();
    });
  }

  if (els.btnEnableAll) {
    els.btnEnableAll.addEventListener('click', () => setAllRulesState(true));
  }

  if (els.btnDisableAll) {
    els.btnDisableAll.addEventListener('click', () => setAllRulesState(false));
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function handleValidate() {
    if (!selectedFile) return;
    els.btnToStep3.disabled = true;
    els.btnToStep3.textContent = 'Validating...';
    try {
      fileText = await readFileAsText(selectedFile);
      const report = window.Validator.run(fileText, ruleState);
      window.Reporter.render(report);
      hasValidated = true;
      lastIssueCount = report.issueCount || 0;
      updateSidebarStatus();
      goToStep(3);
    } catch (err) {
      alert('Could not read file: ' + err.message);
    } finally {
      els.btnToStep3.disabled = false;
      els.btnToStep3.textContent = 'Validate';
    }
  }

  els.fileInput.addEventListener('change', handleFileSelect);
  els.btnToStep2.addEventListener('click', () => {
    renderCategoryTabs();
    renderRulesList();
    goToStep(2);
  });
  els.btnBackTo1.addEventListener('click', () => goToStep(1));
  els.btnBackTo2.addEventListener('click', () => goToStep(2));
  els.btnToStep3.addEventListener('click', handleValidate);

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => window.Reporter.setFilter(btn.dataset.filter));
  });

  if (window.Reporter && window.Reporter.init) {
    window.Reporter.init();
  }

  goToStep(1);
})();
