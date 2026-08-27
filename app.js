// Main controller: stepper nav, file handling, wires modules together
(function () {
  let currentStep = 1;
  let selectedFile = null;
  let fileText = null;

  // In-memory rule toggle state. Seeded from config.js defaults, never writes back to config.js.
  const ruleState = {};
  window.RULES_CONFIG.forEach(rule => { ruleState[rule.id] = rule.enabled; });

  const els = {
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    uploadBox: document.getElementById('uploadBox'),
    btnToStep2: document.getElementById('btnToStep2'),
    btnToStep3: document.getElementById('btnToStep3'),
    btnBackTo1: document.getElementById('btnBackTo1'),
    btnBackTo2: document.getElementById('btnBackTo2'),
    rulesList: document.getElementById('rulesList'),
    steps: document.querySelectorAll('.step-panel'),
    stepperItems: document.querySelectorAll('.stepper-item')
  };

  els.uploadBox.addEventListener('click', (e) => {
    if (e.target === els.fileInput) return;
    els.fileInput.click();
  });

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
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      selectedFile = null;
      els.fileName.innerHTML = '';
      els.uploadBox.style.display = '';
      els.btnToStep2.disabled = true;
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xhtml')) {
      els.fileName.innerHTML = '<div class="file-error">Please select a .xhtml file.</div>';
      els.uploadBox.style.display = '';
      els.btnToStep2.disabled = true;
      selectedFile = null;
      return;
    }
    selectedFile = file;
    els.uploadBox.style.display = 'none';
    els.fileName.innerHTML = `
      <div class="file-card">
        <div class="file-card-icon">⎘</div>
        <div class="file-card-body">
          <div class="file-card-name">${file.name}</div>
          <div class="file-card-size">${formatSize(file.size)}</div>
        </div>
        <button type="button" id="btnChangeFile" class="btn btn-secondary btn-sm">Change</button>
      </div>
    `;
    document.getElementById('btnChangeFile').addEventListener('click', () => {
      els.fileInput.value = '';
      selectedFile = null;
      els.fileName.innerHTML = '';
      els.uploadBox.style.display = '';
      els.btnToStep2.disabled = true;
    });
    els.btnToStep2.disabled = false;
  }

  function renderRulesList() {
    els.rulesList.innerHTML = '';
    window.RULES_CONFIG.filter(rule => rule.enabled).forEach(rule => {
      const on = ruleState[rule.id];
      const item = document.createElement('div');
      item.className = 'rule-item ' + (on ? 'rule-enabled' : 'rule-disabled');
      item.innerHTML = `
        <button class="toggle-switch ${on ? 'on' : ''}" data-rule-id="${rule.id}" role="switch" aria-checked="${on}"></button>
        <div class="rule-body">
          <div class="rule-name">${rule.name}</div>
          <div class="rule-desc">${rule.description}</div>
        </div>
        <div class="rule-severity severity-${rule.severity}">${rule.severity}</div>
      `;
      els.rulesList.appendChild(item);
    });

    els.rulesList.querySelectorAll('.toggle-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.ruleId;
        ruleState[id] = !ruleState[id];
        renderRulesList();
      });
    });
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
    renderRulesList();
    goToStep(2);
  });
  els.btnBackTo1.addEventListener('click', () => goToStep(1));
  els.btnBackTo2.addEventListener('click', () => goToStep(2));
  els.btnToStep3.addEventListener('click', handleValidate);

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => window.Reporter.setFilter(btn.dataset.filter));
  });

  goToStep(1);
})();
