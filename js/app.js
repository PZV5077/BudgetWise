/* ============================================
   BudgetWise — Main Application JavaScript
   Pure JS, localStorage + auto CSV persistence
   ============================================ */

(function() {
  'use strict';

  // ─── Default Data ───
  const DEFAULT_EXPENSE_CATS = [
    'Housing', 'Groceries', 'Transport', 'Utilities', 'Entertainment',
    'Dining Out', 'Health', 'Shopping', 'Education', 'Subscriptions', 'Other'
  ];
  const DEFAULT_INCOME_CATS = [
    'Salary', 'Freelance', 'Investments', 'Benefits', 'Gifts', 'Other'
  ];

  const SAVING_TIPS = [
    "Try a no-spend day once a week — small sacrifices add up over a year.",
    "Switch to own-brand products at the supermarket and save up to 30%.",
    "Review your subscriptions monthly — cancel what you don't use.",
    "Use the 24-hour rule: wait a day before any non-essential purchase.",
    "Bring lunch to work — you could save over £1,500 a year.",
    "Set up automatic transfers to savings on payday, even £20 helps.",
    "Compare energy tariffs annually — switching can save hundreds.",
    "Use cashback apps and websites for purchases you'd make anyway.",
    "Plan your meals for the week to reduce food waste and spending.",
    "Walk or cycle for short trips instead of driving or taking the bus.",
    "Negotiate your bills — broadband, insurance, and phone contracts are often flexible.",
    "Unplug devices on standby to cut your electricity bill.",
    "Use the library for books, audiobooks, and even free events.",
    "Batch cook meals and freeze portions for busy days.",
    "Track every penny for a month — awareness is the first step to saving.",
    "Set a specific savings goal — you're 42% more likely to achieve it.",
    "Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings.",
    "Check for student, senior, or military discounts before you pay.",
    "Sell unused items around your home — declutter and earn.",
    "Make coffee at home — a daily café habit can cost over £900 a year."
  ];

  const THEME_PRESETS = {
    default: { primary: '#2563eb', accent: '#059669', bg: '#f8f9fa', card: '#ffffff', text: '#1a1a2e' },
    dark:    { primary: '#3b82f6', accent: '#10b981', bg: '#111827', card: '#1f2937', text: '#f3f4f6' },
    ocean:   { primary: '#0284c7', accent: '#0891b2', bg: '#f0f9ff', card: '#ffffff', text: '#0c4a6e' },
    forest:  { primary: '#15803d', accent: '#a16207', bg: '#f0fdf4', card: '#ffffff', text: '#14532d' },
    rose:    { primary: '#be185d', accent: '#9333ea', bg: '#fdf2f8', card: '#ffffff', text: '#4a044e' }
  };

  // CSV file names stored in root directory
  const CSV_FILES = {
    transactions: 'budgetwise_transactions.csv',
    budgets: 'budgetwise_budgets.csv',
    challenge: 'budgetwise_challenge.csv',
    categories: 'budgetwise_categories.csv',
    settings: 'budgetwise_settings.csv'
  };
  const STORAGE_KEYS = {
    data: 'budgetwise_data',
    legacyData: ['bud', 'gewise_data'].join(''),
    fsGranted: 'budgetwise_fs_granted',
    legacyFsGranted: ['bud', 'gewise_fs_granted'].join('')
  };
  const EXPORT_FILES = {
    transactions: 'budgetwise_transactions_export.csv',
    backup: 'budgetwise_backup.json'
  };

  // ─── State ───
  let state = {
    transactions: [],
    expenseCategories: [...DEFAULT_EXPENSE_CATS],
    incomeCategories: [...DEFAULT_INCOME_CATS],
    budgets: {},
    challenge: null,
    theme: { ...THEME_PRESETS.default },
    currentMonth: new Date()
  };

  // ─── File System Access API handles ───
  let dirHandle = null;       // root directory handle
  let fsAccessGranted = false; // whether we have write access

  // ─── Utility Functions ───
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(amount) {
    return '£' + Math.abs(amount).toFixed(2);
  }

  function monthKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function prevMonth(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() - 1);
    return d;
  }

  function nextMonth(date) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function escapeCSV(val) {
    const s = String(val == null ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // ─── File System Access API — CSV Auto-Save ───

  async function requestDirectoryAccess() {
    if (!window.showDirectoryPicker) {
      return false;
    }
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      fsAccessGranted = true;
      localStorage.setItem(STORAGE_KEYS.fsGranted, '1');
      localStorage.removeItem(STORAGE_KEYS.legacyFsGranted);
      updateFsStatusUI();
      // Immediately save all CSVs
      await saveAllCSVs();
      return true;
    } catch (e) {
      console.warn('Directory access denied or cancelled:', e);
      fsAccessGranted = false;
      return false;
    }
  }

  async function writeCSVFile(filename, content) {
    if (!dirHandle || !fsAccessGranted) return false;
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.warn('Failed to write ' + filename + ':', e);
      // If permission was revoked, mark as not granted
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        fsAccessGranted = false;
        updateFsStatusUI();
      }
      return false;
    }
  }

  async function readCSVFile(filename) {
    if (!dirHandle) return null;
    try {
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      // File doesn't exist yet — that's fine
      return null;
    }
  }

  // ─── CSV Serialisation / Deserialisation ───

  function transactionsToCSV() {
    let csv = 'ID,Date,Type,Category,Description,Amount,Notes\n';
    state.transactions.forEach(t => {
      csv += [
        escapeCSV(t.id),
        escapeCSV(t.date),
        escapeCSV(t.type),
        escapeCSV(t.category),
        escapeCSV(t.description),
        t.amount.toFixed(2),
        escapeCSV(t.notes || '')
      ].join(',') + '\n';
    });
    return csv;
  }

  function budgetsToCSV() {
    let csv = 'Month,Type,Category,Value\n';
    Object.entries(state.budgets).forEach(([mk, b]) => {
      csv += [escapeCSV(mk), 'overall', '', b.overall.toFixed(2)].join(',') + '\n';
      if (b.categories) {
        Object.entries(b.categories).forEach(([cat, val]) => {
          csv += [escapeCSV(mk), 'category', escapeCSV(cat), val.toFixed(2)].join(',') + '\n';
        });
      }
    });
    return csv;
  }

  function challengeToCSV() {
    if (!state.challenge) return 'StartDate,SavedDays,Withdrawn\n';
    return 'StartDate,SavedDays,Withdrawn\n' +
      escapeCSV(state.challenge.startDate) + ',' +
      escapeCSV((state.challenge.savedDays || []).join(';')) + ',' +
      (state.challenge.withdrawn ? 'true' : 'false') + '\n';
  }

  function categoriesToCSV() {
    let csv = 'Type,Name\n';
    state.expenseCategories.forEach(c => {
      csv += 'expense,' + escapeCSV(c) + '\n';
    });
    state.incomeCategories.forEach(c => {
      csv += 'income,' + escapeCSV(c) + '\n';
    });
    return csv;
  }

  function settingsToCSV() {
    let csv = 'Key,Value\n';
    csv += 'theme_primary,' + escapeCSV(state.theme.primary) + '\n';
    csv += 'theme_accent,' + escapeCSV(state.theme.accent) + '\n';
    csv += 'theme_bg,' + escapeCSV(state.theme.bg) + '\n';
    csv += 'theme_card,' + escapeCSV(state.theme.card) + '\n';
    csv += 'theme_text,' + escapeCSV(state.theme.text) + '\n';
    return csv;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i+1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  function csvToTransactions(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const idIdx = header.indexOf('id');
    const dateIdx = header.indexOf('date');
    const typeIdx = header.indexOf('type');
    const catIdx = header.indexOf('category');
    const descIdx = header.indexOf('description');
    const amountIdx = header.indexOf('amount');
    const notesIdx = header.indexOf('notes');
    if (dateIdx < 0 || amountIdx < 0) return null;

    const trans = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;
      const amount = parseFloat(cols[amountIdx]);
      if (isNaN(amount) || amount <= 0) continue;
      trans.push({
        id: (idIdx >= 0 && cols[idIdx]) ? cols[idIdx] : genId(),
        date: cols[dateIdx] || todayStr(),
        type: (typeIdx >= 0 && cols[typeIdx]) ? cols[typeIdx].toLowerCase() : 'expense',
        category: (catIdx >= 0 && cols[catIdx]) ? cols[catIdx] : 'Other',
        description: (descIdx >= 0 && cols[descIdx]) ? cols[descIdx] : 'Imported',
        amount: Math.abs(amount),
        notes: (notesIdx >= 0 && cols[notesIdx]) ? cols[notesIdx] : ''
      });
    }
    return trans.length > 0 ? trans : null;
  }

  function csvToBudgets(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const budgets = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 4) continue;
      const mk = cols[0], type = cols[1], cat = cols[2], val = parseFloat(cols[3]);
      if (!mk || isNaN(val)) continue;
      if (!budgets[mk]) budgets[mk] = { overall: 0, categories: {} };
      if (type === 'overall') budgets[mk].overall = val;
      else if (type === 'category' && cat) budgets[mk].categories[cat] = val;
    }
    return Object.keys(budgets).length > 0 ? budgets : null;
  }

  function csvToChallenge(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const cols = parseCSVLine(lines[1]);
    if (cols.length < 3 || !cols[0]) return null;
    return {
      startDate: cols[0],
      savedDays: cols[1] ? cols[1].split(';').filter(s => s).map(Number) : [],
      withdrawn: cols[2] === 'true'
    };
  }

  function csvToCategories(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const expense = [], income = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 2) continue;
      if (cols[0] === 'expense') expense.push(cols[1]);
      else if (cols[0] === 'income') income.push(cols[1]);
    }
    return (expense.length > 0 || income.length > 0) ? { expense, income } : null;
  }

  function csvToSettings(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    const settings = {};
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.length >= 2) settings[cols[0]] = cols[1];
    }
    if (settings.theme_primary) {
      return {
        primary: settings.theme_primary,
        accent: settings.theme_accent || '#059669',
        bg: settings.theme_bg || '#f8f9fa',
        card: settings.theme_card || '#ffffff',
        text: settings.theme_text || '#1a1a2e'
      };
    }
    return null;
  }

  // ─── Persistence Layer ───

  async function saveAllCSVs() {
    if (!dirHandle || !fsAccessGranted) return;
    const results = await Promise.all([
      writeCSVFile(CSV_FILES.transactions, transactionsToCSV()),
      writeCSVFile(CSV_FILES.budgets, budgetsToCSV()),
      writeCSVFile(CSV_FILES.challenge, challengeToCSV()),
      writeCSVFile(CSV_FILES.categories, categoriesToCSV()),
      writeCSVFile(CSV_FILES.settings, settingsToCSV())
    ]);
    const allOk = results.every(r => r);
    flashSaveIndicator(allOk);
  }

  async function loadFromCSVs() {
    if (!dirHandle) return false;
    try {
      const [transText, budgetsText, challengeText, catsText, settingsText] = await Promise.all([
        readCSVFile(CSV_FILES.transactions),
        readCSVFile(CSV_FILES.budgets),
        readCSVFile(CSV_FILES.challenge),
        readCSVFile(CSV_FILES.categories),
        readCSVFile(CSV_FILES.settings)
      ]);

      const trans = csvToTransactions(transText);
      if (trans) state.transactions = trans;

      const budgets = csvToBudgets(budgetsText);
      if (budgets) state.budgets = budgets;

      const challenge = csvToChallenge(challengeText);
      if (challenge) state.challenge = challenge;

      const cats = csvToCategories(catsText);
      if (cats) {
        if (cats.expense.length > 0) state.expenseCategories = cats.expense;
        if (cats.income.length > 0) state.incomeCategories = cats.income;
      }

      const theme = csvToSettings(settingsText);
      if (theme) state.theme = theme;

      return true;
    } catch (e) {
      console.warn('Failed to load from CSVs:', e);
      return false;
    }
  }

  function saveState() {
    // Always save to localStorage as fast cache
    const data = {
      transactions: state.transactions,
      expenseCategories: state.expenseCategories,
      incomeCategories: state.incomeCategories,
      budgets: state.budgets,
      challenge: state.challenge,
      theme: state.theme
    };
    try {
      localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(data));
      localStorage.removeItem(STORAGE_KEYS.legacyData);
    } catch(e) {
      console.warn('Failed to save to localStorage:', e);
    }
    // Auto-save to CSV files in background
    saveAllCSVs();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.data) || localStorage.getItem(STORAGE_KEYS.legacyData);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.transactions) state.transactions = data.transactions;
      if (data.expenseCategories) state.expenseCategories = data.expenseCategories;
      if (data.incomeCategories) state.incomeCategories = data.incomeCategories;
      if (data.budgets) state.budgets = data.budgets;
      if (data.challenge) state.challenge = data.challenge;
      if (data.theme) state.theme = data.theme;
      if (!localStorage.getItem(STORAGE_KEYS.data)) {
        localStorage.setItem(STORAGE_KEYS.data, raw);
      }
      localStorage.removeItem(STORAGE_KEYS.legacyData);
    } catch(e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }

  // ─── Save Indicator ───
  function flashSaveIndicator(success) {
    const el = document.getElementById('saveIndicator');
    if (!el) return;
    el.textContent = success ? '✓ Saved to CSV' : '✗ CSV save failed';
    el.className = 'save-indicator ' + (success ? 'success' : 'error');
    el.classList.add('show');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function updateFsStatusUI() {
    const statusEl = document.getElementById('fsStatus');
    const connectBtn = document.getElementById('fsConnectBtn');
    const disconnectBtn = document.getElementById('fsDisconnectBtn');
    if (!statusEl) return;

    if (!window.showDirectoryPicker) {
      statusEl.innerHTML = '<span class="fs-badge unsupported">Not Supported</span> Your browser does not support the File System Access API. Please use Chrome or Edge.';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'none';
      return;
    }

    if (fsAccessGranted && dirHandle) {
      statusEl.innerHTML = '<span class="fs-badge connected">Connected</span> Auto-saving to <strong>' + escapeHtml(dirHandle.name) + '/</strong>';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
    } else {
      statusEl.innerHTML = '<span class="fs-badge disconnected">Not Connected</span> Click "Connect Folder" to enable auto-save to CSV files.';
      connectBtn.style.display = '';
      disconnectBtn.style.display = 'none';
    }
  }

  // ─── Theme System ───
  function applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-light', adjustColor(theme.primary, 20));
    root.style.setProperty('--primary-dark', adjustColor(theme.primary, -20));
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-light', adjustColor(theme.accent, 20));
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--bg-alt', adjustColor(theme.bg, -8));
    root.style.setProperty('--card', theme.card);
    root.style.setProperty('--card-border', adjustColor(theme.card, -18));
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-secondary', blendColor(theme.text, theme.bg, 0.45));
    root.style.setProperty('--text-muted', blendColor(theme.text, theme.bg, 0.6));

    document.getElementById('colorPrimary').value = theme.primary;
    document.getElementById('colorAccent').value = theme.accent;
    document.getElementById('colorBg').value = theme.bg;
    document.getElementById('colorCard').value = theme.card;
    document.getElementById('colorText').value = theme.text;
  }

  function adjustColor(hex, amount) {
    hex = hex.replace('#', '');
    let r = clamp(parseInt(hex.substr(0,2),16) + amount, 0, 255);
    let g = clamp(parseInt(hex.substr(2,2),16) + amount, 0, 255);
    let b = clamp(parseInt(hex.substr(4,2),16) + amount, 0, 255);
    return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
  }

  function blendColor(hex1, hex2, ratio) {
    hex1 = hex1.replace('#',''); hex2 = hex2.replace('#','');
    let r = Math.round(parseInt(hex1.substr(0,2),16)*(1-ratio) + parseInt(hex2.substr(0,2),16)*ratio);
    let g = Math.round(parseInt(hex1.substr(2,2),16)*(1-ratio) + parseInt(hex2.substr(2,2),16)*ratio);
    let b = Math.round(parseInt(hex1.substr(4,2),16)*(1-ratio) + parseInt(hex2.substr(4,2),16)*ratio);
    return '#' + [r,g,b].map(c => clamp(c,0,255).toString(16).padStart(2,'0')).join('');
  }

  function initThemePanel() {
    const panel = document.getElementById('themePanel');
    const overlay = document.getElementById('themeOverlay');
    const toggleBtn = document.getElementById('themeToggleBtn');
    const closeBtn = document.getElementById('themePanelClose');

    function openPanel() { panel.classList.add('open'); overlay.classList.add('open'); }
    function closePanel() { panel.classList.remove('open'); overlay.classList.remove('open'); }

    toggleBtn.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    ['colorPrimary','colorAccent','colorBg','colorCard','colorText'].forEach(id => {
      document.getElementById(id).addEventListener('input', function() {
        state.theme = {
          primary: document.getElementById('colorPrimary').value,
          accent: document.getElementById('colorAccent').value,
          bg: document.getElementById('colorBg').value,
          card: document.getElementById('colorCard').value,
          text: document.getElementById('colorText').value
        };
        applyTheme(state.theme);
        saveState();
      });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const preset = this.dataset.preset;
        if (THEME_PRESETS[preset]) {
          state.theme = { ...THEME_PRESETS[preset] };
          applyTheme(state.theme);
          saveState();
        }
      });
    });
  }

  // ─── Navigation ───
  window.switchTab = function(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    const tab = document.getElementById('tab-' + tabName);
    if (btn) btn.classList.add('active');
    if (tab) tab.classList.add('active');
    refreshCurrentTab(tabName);
  };

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        switchTab(this.dataset.tab);
      });
    });
  }

  function refreshCurrentTab(tabName) {
    if (tabName === 'dashboard') refreshDashboard();
    else if (tabName === 'transactions') refreshTransactions();
    else if (tabName === 'budgets') refreshBudgets();
    else if (tabName === 'challenge') refreshChallenge();
    else if (tabName === 'settings') refreshSettings();
  }

  function getCurrentTab() {
    const active = document.querySelector('.nav-btn.active');
    return active ? active.dataset.tab : 'dashboard';
  }

  // ─── Month Navigation Helpers ───
  function updateAllMonthDisplays() {
    const label = monthLabel(state.currentMonth);
    document.getElementById('dashCurrentMonth').textContent = label;
    document.getElementById('transCurrentMonth').textContent = label;
    document.getElementById('budgetCurrentMonth').textContent = label;
  }

  function initMonthNavigation() {
    const handlers = [
      ['dashPrevMonth', 'dashNextMonth'],
      ['transPrevMonth', 'transNextMonth'],
      ['budgetPrevMonth', 'budgetNextMonth']
    ];

    handlers.forEach(([prevId, nextId]) => {
      document.getElementById(prevId).addEventListener('click', () => {
        state.currentMonth = prevMonth(state.currentMonth);
        updateAllMonthDisplays();
        refreshCurrentTab(getCurrentTab());
      });
      document.getElementById(nextId).addEventListener('click', () => {
        state.currentMonth = nextMonth(state.currentMonth);
        updateAllMonthDisplays();
        refreshCurrentTab(getCurrentTab());
      });
    });
  }

  // ─── Data Queries ───
  function getTransactionsForMonth(date) {
    const key = monthKey(date);
    return state.transactions.filter(t => monthKey(t.date) === key);
  }

  function getMonthTotals(date) {
    const trans = getTransactionsForMonth(date);
    let income = 0, expense = 0;
    trans.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }

  function getCategoryTotals(date, type) {
    const trans = getTransactionsForMonth(date).filter(t => t.type === type);
    const totals = {};
    trans.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return totals;
  }

  function getBudgetForMonth(date) {
    const key = monthKey(date);
    return state.budgets[key] || { overall: 0, categories: {} };
  }

  // ─── Dashboard ───
  function refreshDashboard() {
    const current = getMonthTotals(state.currentMonth);
    const prev = getMonthTotals(prevMonth(state.currentMonth));
    const budget = getBudgetForMonth(state.currentMonth);

    document.getElementById('dashIncome').textContent = formatCurrency(current.income);
    document.getElementById('dashExpense').textContent = formatCurrency(current.expense);
    document.getElementById('dashBalance').textContent = (current.balance >= 0 ? '£' : '-£') + Math.abs(current.balance).toFixed(2);

    setCompare('dashIncomeCompare', current.income, prev.income, true);
    setCompare('dashExpenseCompare', current.expense, prev.expense, false);
    setCompare('dashBalanceCompare', current.balance, prev.balance, true);

    if (budget.overall > 0) {
      const pct = (current.expense / budget.overall) * 100;
      document.getElementById('dashBudgetUsed').textContent = Math.round(pct) + '%';
      const bar = document.getElementById('dashBudgetBar');
      bar.style.width = Math.min(pct, 100) + '%';
      bar.className = 'budget-bar' + (pct > 100 ? ' over' : pct > 80 ? ' warning' : '');
    } else {
      document.getElementById('dashBudgetUsed').textContent = 'No target';
      document.getElementById('dashBudgetBar').style.width = '0%';
    }

    renderCategoryChart();
    renderComparisonChart();
    renderRecentTransactions();
  }

  function setCompare(elId, current, previous, higherIsGood) {
    const el = document.getElementById(elId);
    if (previous === 0) {
      el.textContent = '';
      el.className = 'summary-compare';
      return;
    }
    const diff = current - previous;
    const pct = ((diff / previous) * 100).toFixed(1);
    const sign = diff >= 0 ? '+' : '';
    el.textContent = `${sign}${pct}% vs last month`;
    const isUp = diff > 0;
    el.className = 'summary-compare ' + ((isUp === higherIsGood) ? 'up' : 'down');
  }

  // ─── SVG Charts ───
  const CHART_COLORS = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d','#ea580c','#6366f1','#0d9488','#c026d3'];

  function renderCategoryChart() {
    const container = document.getElementById('categoryChart');
    const catTotals = getCategoryTotals(state.currentMonth, 'expense');
    const entries = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);

    if (entries.length === 0) {
      container.innerHTML = '<div class="chart-empty">No expenses this month</div>';
      return;
    }

    const total = entries.reduce((s, e) => s + e[1], 0);
    const w = 400, h = 220, cx = 110, cy = 110, r = 90;
    let svg = `<svg class="svg-chart" viewBox="0 0 ${w} ${h}">`;

    let startAngle = -Math.PI / 2;
    entries.forEach(([cat, amount], i) => {
      const slice = (amount / total) * 2 * Math.PI;
      const endAngle = startAngle + slice;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = slice > Math.PI ? 1 : 0;
      const color = CHART_COLORS[i % CHART_COLORS.length];

      svg += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}" opacity="0.85">
        <title>${cat}: ${formatCurrency(amount)} (${((amount/total)*100).toFixed(1)}%)</title></path>`;
      startAngle = endAngle;
    });

    let ly = 10;
    entries.slice(0, 8).forEach(([cat, amount], i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length];
      const pct = ((amount / total) * 100).toFixed(1);
      svg += `<rect x="230" y="${ly}" width="10" height="10" fill="${color}" rx="1"/>`;
      svg += `<text x="246" y="${ly + 9}" class="pie-label">${cat} (${pct}%)</text>`;
      ly += 22;
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderComparisonChart() {
    const container = document.getElementById('comparisonChart');
    const current = getMonthTotals(state.currentMonth);
    const prev = getMonthTotals(prevMonth(state.currentMonth));

    const maxVal = Math.max(current.income, current.expense, prev.income, prev.expense, 1);
    const w = 400, h = 220;
    const barW = 40, gap = 20;
    const chartH = 160, baseY = 190;

    let svg = `<svg class="svg-chart" viewBox="0 0 ${w} ${h}">`;

    svg += `<line x1="40" y1="${baseY}" x2="380" y2="${baseY}" stroke="var(--card-border)" stroke-width="1"/>`;

    const groups = [
      { label: 'Income', current: current.income, prev: prev.income },
      { label: 'Expenses', current: current.expense, prev: prev.expense },
      { label: 'Balance', current: current.balance, prev: prev.balance }
    ];

    const groupW = (w - 80) / groups.length;

    groups.forEach((g, gi) => {
      const gx = 50 + gi * groupW;
      const scale = chartH / Math.max(maxVal, 1);

      const ph = Math.abs(g.prev) * scale;
      svg += `<rect x="${gx}" y="${baseY - ph}" width="${barW}" height="${ph}" fill="var(--card-border)" rx="1"/>`;
      const prevSign = g.prev < 0 ? '-' : '';
      svg += `<text x="${gx + barW/2}" y="${baseY - ph - 4}" text-anchor="middle" class="bar-value">${prevSign}${formatCurrency(g.prev)}</text>`;

      const ch = Math.abs(g.current) * scale;
      const color = gi === 0 ? 'var(--accent)' : gi === 1 ? 'var(--danger)' : 'var(--primary)';
      svg += `<rect x="${gx + barW + 6}" y="${baseY - ch}" width="${barW}" height="${ch}" fill="${color}" opacity="0.85" rx="1"/>`;
      const curSign = g.current < 0 ? '-' : '';
      svg += `<text x="${gx + barW + 6 + barW/2}" y="${baseY - ch - 4}" text-anchor="middle" class="bar-value">${curSign}${formatCurrency(g.current)}</text>`;

      svg += `<text x="${gx + barW + 3}" y="${baseY + 14}" text-anchor="middle" class="bar-label">${g.label}</text>`;
    });

    svg += `<rect x="140" y="4" width="10" height="10" fill="var(--card-border)" rx="1"/>`;
    svg += `<text x="155" y="13" class="bar-label">Last Month</text>`;
    svg += `<rect x="240" y="4" width="10" height="10" fill="var(--primary)" opacity="0.85" rx="1"/>`;
    svg += `<text x="255" y="13" class="bar-label">This Month</text>`;

    svg += '</svg>';
    container.innerHTML = svg;
  }

  function renderRecentTransactions() {
    const tbody = document.querySelector('#recentTransTable tbody');
    const trans = getTransactionsForMonth(state.currentMonth)
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (trans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">No transactions this month</td></tr>';
      return;
    }

    tbody.innerHTML = trans.map(t => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.description)}</td>
        <td><span class="cat-badge">${escapeHtml(t.category)}</span></td>
        <td class="text-right ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
      </tr>
    `).join('');
  }

  // ─── Transactions Tab ───
  function refreshTransactions() {
    let trans = getTransactionsForMonth(state.currentMonth);

    const typeFilter = document.getElementById('filterType').value;
    const catFilter = document.getElementById('filterCategory').value;
    const searchFilter = document.getElementById('filterSearch').value.toLowerCase().trim();

    if (typeFilter !== 'all') trans = trans.filter(t => t.type === typeFilter);
    if (catFilter !== 'all') trans = trans.filter(t => t.category === catFilter);
    if (searchFilter) trans = trans.filter(t => t.description.toLowerCase().includes(searchFilter));

    trans.sort((a,b) => new Date(b.date) - new Date(a.date));

    const tbody = document.querySelector('#transTable tbody');
    const empty = document.getElementById('transEmpty');

    if (trans.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      tbody.innerHTML = trans.map(t => `
        <tr>
          <td>${formatDate(t.date)}</td>
          <td>${escapeHtml(t.description)}${t.notes ? '<br><small style="color:var(--text-muted)">' + escapeHtml(t.notes) + '</small>' : ''}</td>
          <td><span class="cat-badge">${escapeHtml(t.category)}</span></td>
          <td class="text-right ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">
            ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
          </td>
          <td class="text-center">
            <button class="btn-icon" onclick="editTransaction('${t.id}')" title="Edit">&#9998;</button>
            <button class="btn-icon delete" onclick="deleteTransaction('${t.id}')" title="Delete">&#10005;</button>
          </td>
        </tr>
      `).join('');
    }

    updateCategoryFilter();
  }

  function updateCategoryFilter() {
    const sel = document.getElementById('filterCategory');
    const current = sel.value;
    const allCats = [...new Set([...state.expenseCategories, ...state.incomeCategories])];
    sel.innerHTML = '<option value="all">All Categories</option>' +
      allCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    sel.value = current;
  }

  // Transaction Modal
  function initTransactionModal() {
    const modal = document.getElementById('transModal');
    const form = document.getElementById('transForm');
    const typeSelect = document.getElementById('transType');

    document.getElementById('addTransBtn').addEventListener('click', () => openTransModal());
    document.getElementById('transModalClose').addEventListener('click', () => closeTransModal());
    document.getElementById('transModalCancel').addEventListener('click', () => closeTransModal());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTransModal();
    });

    typeSelect.addEventListener('change', () => updateTransCatOptions());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTransaction();
    });

    ['filterType','filterCategory'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => refreshTransactions());
    });
    document.getElementById('filterSearch').addEventListener('input', () => refreshTransactions());
  }

  function openTransModal(editId) {
    const modal = document.getElementById('transModal');
    const title = document.getElementById('transModalTitle');
    document.getElementById('transEditId').value = editId || '';

    if (editId) {
      title.textContent = 'Edit Transaction';
      const t = state.transactions.find(tr => tr.id === editId);
      if (t) {
        document.getElementById('transType').value = t.type;
        updateTransCatOptions();
        document.getElementById('transDate').value = t.date;
        document.getElementById('transDesc').value = t.description;
        document.getElementById('transCat').value = t.category;
        document.getElementById('transAmount').value = t.amount;
        document.getElementById('transNotes').value = t.notes || '';
      }
    } else {
      title.textContent = 'Add Transaction';
      document.getElementById('transType').value = 'expense';
      updateTransCatOptions();
      document.getElementById('transDate').value = todayStr();
      document.getElementById('transDesc').value = '';
      document.getElementById('transAmount').value = '';
      document.getElementById('transNotes').value = '';
    }

    modal.classList.add('open');
  }

  function closeTransModal() {
    document.getElementById('transModal').classList.remove('open');
  }

  function updateTransCatOptions() {
    const type = document.getElementById('transType').value;
    const cats = type === 'income' ? state.incomeCategories : state.expenseCategories;
    const sel = document.getElementById('transCat');
    sel.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function saveTransaction() {
    const editId = document.getElementById('transEditId').value;
    const data = {
      type: document.getElementById('transType').value,
      date: document.getElementById('transDate').value,
      description: document.getElementById('transDesc').value.trim(),
      category: document.getElementById('transCat').value,
      amount: parseFloat(document.getElementById('transAmount').value),
      notes: document.getElementById('transNotes').value.trim()
    };

    if (!data.description || !data.date || isNaN(data.amount) || data.amount <= 0) return;

    if (editId) {
      const idx = state.transactions.findIndex(t => t.id === editId);
      if (idx >= 0) {
        state.transactions[idx] = { ...state.transactions[idx], ...data };
      }
    } else {
      state.transactions.push({ id: genId(), ...data });
    }

    saveState();
    closeTransModal();
    refreshCurrentTab(getCurrentTab());
  }

  window.editTransaction = function(id) {
    openTransModal(id);
  };

  window.deleteTransaction = function(id) {
    if (!confirm('Delete this transaction?')) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    refreshCurrentTab(getCurrentTab());
  };

  // ─── Budgets Tab ───
  function refreshBudgets() {
    const key = monthKey(state.currentMonth);
    const budget = getBudgetForMonth(state.currentMonth);
    const totals = getMonthTotals(state.currentMonth);
    const prevTotals = getMonthTotals(prevMonth(state.currentMonth));

    document.getElementById('overallBudgetInput').value = budget.overall || '';
    document.getElementById('overallSpent').textContent = formatCurrency(totals.expense);

    const remaining = (budget.overall || 0) - totals.expense;
    document.getElementById('overallRemaining').textContent = (remaining >= 0 ? '£' : '-£') + Math.abs(remaining).toFixed(2);
    document.getElementById('overallRemaining').style.color = remaining >= 0 ? 'var(--accent)' : 'var(--danger)';
    document.getElementById('overallLastMonth').textContent = formatCurrency(prevTotals.expense);

    if (budget.overall > 0) {
      const pct = (totals.expense / budget.overall) * 100;
      const bar = document.getElementById('overallBudgetBar');
      bar.style.width = Math.min(pct, 100) + '%';
      bar.className = 'budget-bar' + (pct > 100 ? ' over' : pct > 80 ? ' warning' : '');
    } else {
      document.getElementById('overallBudgetBar').style.width = '0%';
    }

    renderCategoryBudgets(budget, key);
    renderMonthComparison();
  }

  function renderCategoryBudgets(budget, key) {
    const container = document.getElementById('categoryBudgetsList');
    const catTotals = getCategoryTotals(state.currentMonth, 'expense');
    const cats = budget.categories || {};

    if (Object.keys(cats).length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:8px 0">No category targets set. Click "Add Category Target" to begin.</p>';
      return;
    }

    container.innerHTML = Object.entries(cats).map(([cat, target]) => {
      const spent = catTotals[cat] || 0;
      const pct = target > 0 ? (spent / target) * 100 : 0;
      const barClass = pct > 100 ? 'over' : pct > 80 ? 'warning' : '';
      return `
        <div class="cat-budget-item">
          <span class="cat-budget-name">${escapeHtml(cat)}</span>
          <div class="cat-budget-bar-wrap">
            <div class="cat-budget-bar ${barClass}" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <span class="cat-budget-values">${formatCurrency(spent)} / ${formatCurrency(target)}</span>
          <div class="cat-budget-actions">
            <button class="btn-icon delete" onclick="removeCategoryBudget('${escapeHtml(cat)}')" title="Remove">&#10005;</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMonthComparison() {
    const container = document.getElementById('monthComparisonGrid');
    const currentCats = getCategoryTotals(state.currentMonth, 'expense');
    const prevCats = getCategoryTotals(prevMonth(state.currentMonth), 'expense');
    const allCats = [...new Set([...Object.keys(currentCats), ...Object.keys(prevCats)])];

    if (allCats.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;padding:8px 0">No data to compare yet.</p>';
      return;
    }

    const maxVal = Math.max(...Object.values(currentCats), ...Object.values(prevCats), 1);

    let html = `
      <div class="comparison-row header">
        <span>Category</span>
        <span>Comparison</span>
        <span>This Month</span>
        <span>Last Month</span>
        <span>Change</span>
      </div>
    `;

    allCats.sort().forEach(cat => {
      const cur = currentCats[cat] || 0;
      const prev = prevCats[cat] || 0;
      const diff = cur - prev;
      const pctChange = prev > 0 ? ((diff / prev) * 100).toFixed(1) : (cur > 0 ? '100' : '0');
      const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
      const curW = (cur / maxVal) * 100;
      const prevW = (prev / maxVal) * 100;

      html += `
        <div class="comparison-row">
          <span>${escapeHtml(cat)}</span>
          <div class="comparison-bar-wrap">
            <div class="comparison-bar previous" style="width:${prevW}%"></div>
            <div class="comparison-bar current" style="width:${curW}%"></div>
          </div>
          <span>${formatCurrency(cur)}</span>
          <span>${formatCurrency(prev)}</span>
          <span class="comparison-change ${changeClass}">${diff >= 0 ? '+' : ''}${pctChange}%</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function initBudgets() {
    document.getElementById('saveOverallBudget').addEventListener('click', () => {
      const key = monthKey(state.currentMonth);
      if (!state.budgets[key]) state.budgets[key] = { overall: 0, categories: {} };
      state.budgets[key].overall = parseFloat(document.getElementById('overallBudgetInput').value) || 0;
      saveState();
      refreshBudgets();
      refreshDashboard();
    });

    const modal = document.getElementById('catBudgetModal');
    document.getElementById('addCategoryBudgetBtn').addEventListener('click', () => {
      const sel = document.getElementById('catBudgetSelect');
      sel.innerHTML = state.expenseCategories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      document.getElementById('catBudgetAmount').value = '';
      modal.classList.add('open');
    });
    document.getElementById('catBudgetModalClose').addEventListener('click', () => modal.classList.remove('open'));
    document.getElementById('catBudgetCancel').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

    document.getElementById('catBudgetForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('catBudgetSelect').value;
      const amount = parseFloat(document.getElementById('catBudgetAmount').value);
      if (!cat || isNaN(amount) || amount < 0) return;

      const key = monthKey(state.currentMonth);
      if (!state.budgets[key]) state.budgets[key] = { overall: 0, categories: {} };
      state.budgets[key].categories[cat] = amount;
      saveState();
      modal.classList.remove('open');
      refreshBudgets();
    });
  }

  window.removeCategoryBudget = function(cat) {
    const key = monthKey(state.currentMonth);
    if (state.budgets[key] && state.budgets[key].categories) {
      delete state.budgets[key].categories[cat];
      saveState();
      refreshBudgets();
    }
  };

  // ─── 365 Challenge ───
  function refreshChallenge() {
    const ch = state.challenge;
    const startBtn = document.getElementById('challengeStartBtn');
    const markBtn = document.getElementById('challengeMarkBtn');
    const resetBtn = document.getElementById('challengeResetBtn');
    const withdrawBtn = document.getElementById('challengeWithdrawBtn');

    if (!ch) {
      startBtn.style.display = '';
      markBtn.style.display = 'none';
      resetBtn.style.display = 'none';
      withdrawBtn.style.display = 'none';
      document.getElementById('challengeTotal').textContent = '£0.00';
      document.getElementById('challengeDay').textContent = 'Day 0';
      document.getElementById('challengeStreak').textContent = '0';
      document.getElementById('challengePercent').textContent = '0';
      document.getElementById('challengeProgressBar').style.width = '0%';
      renderChallengeCalendar(null);
      return;
    }

    startBtn.style.display = 'none';
    markBtn.style.display = '';
    resetBtn.style.display = '';

    const startDate = new Date(ch.startDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    startDate.setHours(0,0,0,0);
    const daysSinceStart = Math.floor((today - startDate) / 86400000);
    const currentDay = Math.min(daysSinceStart + 1, 365);

    const savedDays = ch.savedDays || [];
    let totalPence = 0;
    savedDays.forEach(d => { totalPence += d; });

    document.getElementById('challengeTotal').textContent = '£' + (totalPence / 100).toFixed(2);
    document.getElementById('challengeDay').textContent = 'Day ' + currentDay;

    let streak = 0;
    for (let d = currentDay; d >= 1; d--) {
      if (savedDays.includes(d)) streak++;
      else break;
    }
    document.getElementById('challengeStreak').textContent = streak;

    const pct = ((savedDays.length / 365) * 100).toFixed(1);
    document.getElementById('challengePercent').textContent = pct;
    document.getElementById('challengeProgressBar').style.width = pct + '%';

    if (savedDays.includes(currentDay)) {
      markBtn.textContent = 'Today Saved ✓';
      markBtn.disabled = true;
    } else if (currentDay <= 365) {
      markBtn.textContent = `Mark Day ${currentDay} (${currentDay}p)`;
      markBtn.disabled = false;
    }

    if (savedDays.length === 365 && !ch.withdrawn) {
      withdrawBtn.style.display = '';
    } else {
      withdrawBtn.style.display = 'none';
    }

    renderChallengeCalendar(ch);
  }

function renderChallengeCalendar(ch) {
    const container = document.getElementById('challengeCalendar');
    if (!ch) {
      container.innerHTML = '<div class="chart-empty" style="min-height:200px">Start the challenge to see your progress calendar</div>';
      return;
    }

    const startDate = new Date(ch.startDate);
    startDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const savedDays = ch.savedDays || [];

    // 计算挑战的结束日期 (365天后)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 364);

    // 确定需要渲染的月份范围
    let currentMonthDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    let html = '<div class="months-wrapper">';
    const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    // 循环生成每一个月的日历
    while (currentMonthDate <= endMonthDate) {
      const year = currentMonthDate.getFullYear();
      const month = currentMonthDate.getMonth();
      const monthName = currentMonthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      html += `<div class="calendar-month">`;
      html += `<h4 class="month-title">${monthName}</h4>`;
      html += `<div class="month-grid">`;

      // 星期表头
      weekdays.forEach(wd => {
        html += `<div class="weekday-header">${wd}</div>`;
      });

      // 计算这个月的第一天是星期几 (0是星期日，转换为 1-7，星期一为1)
      let firstDayIndex = new Date(year, month, 1).getDay();
      firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // 填充前面的空白天数
      for (let i = 0; i < firstDayIndex; i++) {
        html += `<div class="challenge-day empty"></div>`;
      }

      // 渲染这个月的每一天
      for (let d = 1; d <= daysInMonth; d++) {
        const iterDate = new Date(year, month, d);
        iterDate.setHours(0,0,0,0);

        // 计算这一天是挑战的第几天
        const daysSinceStart = Math.floor((iterDate - startDate) / 86400000);
        const challengeDayNum = daysSinceStart + 1;

        // 判断这一天是否在 365 天的挑战范围内
        if (challengeDayNum >= 1 && challengeDayNum <= 365) {
          let cls = 'challenge-day ';
          const isToday = (iterDate.getTime() === today.getTime());
          const isPast = (iterDate < today);
          const isSaved = savedDays.includes(challengeDayNum);

          if (isSaved) cls += 'saved';
          else if (isToday) cls += 'today';
          else if (isPast) cls += 'missed';
          else cls += 'upcoming';

          const displayDate = iterDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          html += `<div class="${cls}" title="${displayDate} - Day ${challengeDayNum}: ${challengeDayNum}p${isSaved ? ' ✓' : ''}">${d}</div>`;
        } else {
          // 不在挑战范围内的日期（变成半透明）
          html += `<div class="challenge-day out-of-bounds">${d}</div>`;
        }
      }

      html += `</div></div>`;
      // 进入下一个月
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function initChallenge() {
    document.getElementById('challengeStartBtn').addEventListener('click', () => {
      state.challenge = {
        startDate: todayStr(),
        savedDays: [],
        withdrawn: false
      };
      saveState();
      refreshChallenge();
    });

    document.getElementById('challengeMarkBtn').addEventListener('click', () => {
      if (!state.challenge) return;
      const startDate = new Date(state.challenge.startDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      startDate.setHours(0,0,0,0);
      const daysSinceStart = Math.floor((today - startDate) / 86400000);
      const currentDay = Math.min(daysSinceStart + 1, 365);

      if (!state.challenge.savedDays.includes(currentDay)) {
        state.challenge.savedDays.push(currentDay);
        saveState();
        refreshChallenge();
      }
    });

    document.getElementById('challengeResetBtn').addEventListener('click', () => {
      if (!confirm('Reset the 365 Challenge? All progress will be lost.')) return;
      state.challenge = null;
      saveState();
      refreshChallenge();
    });

    document.getElementById('challengeWithdrawBtn').addEventListener('click', () => {
      if (!state.challenge) return;
      state.challenge.withdrawn = true;
      saveState();
      alert('Congratulations! You\'ve completed the 365 Penny Challenge and saved £667.95!');
      refreshChallenge();
    });
  }

  // ─── Settings ───
  function refreshSettings() {
    renderCategoryList('expenseCatList', state.expenseCategories, 'expense');
    renderCategoryList('incomeCatList', state.incomeCategories, 'income');
    updateFsStatusUI();
  }

  function renderCategoryList(containerId, cats, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = cats.map(c => `
      <span class="cat-tag">
        ${escapeHtml(c)}
        <button class="remove-cat" onclick="removeCategory('${type}', '${escapeHtml(c)}')">&times;</button>
      </span>
    `).join('');
  }

  function initSettings() {
    document.getElementById('addExpenseCatBtn').addEventListener('click', () => {
      const input = document.getElementById('newExpenseCat');
      const val = input.value.trim();
      if (val && !state.expenseCategories.includes(val)) {
        state.expenseCategories.push(val);
        saveState();
        refreshSettings();
        input.value = '';
      }
    });

    document.getElementById('addIncomeCatBtn').addEventListener('click', () => {
      const input = document.getElementById('newIncomeCat');
      const val = input.value.trim();
      if (val && !state.incomeCategories.includes(val)) {
        state.incomeCategories.push(val);
        saveState();
        refreshSettings();
        input.value = '';
      }
    });

    // Data management
    document.getElementById('exportAllBtn').addEventListener('click', exportAllJSON);
    document.getElementById('importAllBtn').addEventListener('click', () => document.getElementById('jsonFileInput').click());
    document.getElementById('jsonFileInput').addEventListener('change', importAllJSON);
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (!confirm('This will delete ALL your data. Are you sure?')) return;
      localStorage.removeItem(STORAGE_KEYS.data);
      localStorage.removeItem(STORAGE_KEYS.legacyData);
      state.transactions = [];
      state.expenseCategories = [...DEFAULT_EXPENSE_CATS];
      state.incomeCategories = [...DEFAULT_INCOME_CATS];
      state.budgets = {};
      state.challenge = null;
      state.theme = { ...THEME_PRESETS.default };
      applyTheme(state.theme);
      saveState();
      refreshCurrentTab(getCurrentTab());
    });

    // File System Access — Connect/Disconnect
    document.getElementById('fsConnectBtn').addEventListener('click', async () => {
      const ok = await requestDirectoryAccess();
      if (ok) {
        // Try loading from CSV if there's data there
        const loaded = await loadFromCSVs();
        if (loaded) {
          applyTheme(state.theme);
          saveState(); // sync localStorage
          refreshCurrentTab(getCurrentTab());
        }
        refreshSettings();
      }
    });

    document.getElementById('fsDisconnectBtn').addEventListener('click', () => {
      dirHandle = null;
      fsAccessGranted = false;
      localStorage.removeItem(STORAGE_KEYS.fsGranted);
      localStorage.removeItem(STORAGE_KEYS.legacyFsGranted);
      updateFsStatusUI();
    });
  }

  window.removeCategory = function(type, cat) {
    if (type === 'expense') {
      state.expenseCategories = state.expenseCategories.filter(c => c !== cat);
    } else {
      state.incomeCategories = state.incomeCategories.filter(c => c !== cat);
    }
    saveState();
    refreshSettings();
  };

  // ─── Manual CSV Import/Export (Transactions page) ───
  function initCSV() {
    document.getElementById('exportCsvBtn').addEventListener('click', exportTransCSV);
    document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('csvFileInput').click());
    document.getElementById('csvFileInput').addEventListener('change', importTransCSV);
  }

  function exportTransCSV() {
    const trans = state.transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (trans.length === 0) {
      alert('No transactions to export.');
      return;
    }

    let csv = 'Date,Type,Category,Description,Amount,Notes\n';
    trans.forEach(t => {
      csv += `${t.date},${t.type},${escapeCSV(t.category)},${escapeCSV(t.description)},${t.amount.toFixed(2)},${escapeCSV(t.notes || '')}\n`;
    });

    downloadFile(csv, EXPORT_FILES.transactions, 'text/csv');
  }

  function importTransCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('CSV file appears empty.'); return; }

      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      const dateIdx = header.indexOf('date');
      const typeIdx = header.indexOf('type');
      const catIdx = header.indexOf('category');
      const descIdx = header.indexOf('description');
      const amountIdx = header.indexOf('amount');
      const notesIdx = header.indexOf('notes');

      if (dateIdx < 0 || amountIdx < 0) {
        alert('CSV must have at least "Date" and "Amount" columns.');
        return;
      }

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 2) continue;

        const date = cols[dateIdx] || todayStr();
        const type = (typeIdx >= 0 && cols[typeIdx]) ? cols[typeIdx].toLowerCase() : 'expense';
        const category = (catIdx >= 0 && cols[catIdx]) ? cols[catIdx] : 'Other';
        const description = (descIdx >= 0 && cols[descIdx]) ? cols[descIdx] : 'Imported';
        const amount = parseFloat(cols[amountIdx]);
        const notes = (notesIdx >= 0 && cols[notesIdx]) ? cols[notesIdx] : '';

        if (isNaN(amount) || amount <= 0) continue;

        state.transactions.push({
          id: genId(),
          date: date,
          type: type === 'income' ? 'income' : 'expense',
          category: category,
          description: description,
          amount: Math.abs(amount),
          notes: notes
        });
        imported++;
      }

      saveState();
      alert(`Imported ${imported} transactions.`);
      refreshCurrentTab(getCurrentTab());
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  // ─── JSON Export/Import ───
  function exportAllJSON() {
    const data = {
      transactions: state.transactions,
      expenseCategories: state.expenseCategories,
      incomeCategories: state.incomeCategories,
      budgets: state.budgets,
      challenge: state.challenge,
      theme: state.theme,
      exportDate: new Date().toISOString()
    };
    downloadFile(JSON.stringify(data, null, 2), EXPORT_FILES.backup, 'application/json');
  }

  function importAllJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.transactions) state.transactions = data.transactions;
        if (data.expenseCategories) state.expenseCategories = data.expenseCategories;
        if (data.incomeCategories) state.incomeCategories = data.incomeCategories;
        if (data.budgets) state.budgets = data.budgets;
        if (data.challenge) state.challenge = data.challenge;
        if (data.theme) { state.theme = data.theme; applyTheme(state.theme); }
        saveState();
        alert('Data imported successfully.');
        refreshCurrentTab(getCurrentTab());
      } catch(err) {
        alert('Invalid JSON file.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Saving Tips ───
  function showRandomTip() {
    const tip = SAVING_TIPS[Math.floor(Math.random() * SAVING_TIPS.length)];
    document.getElementById('savingTip').textContent = tip;
  }

  // ─── Initialise ───
  function init() {
    loadState();
    applyTheme(state.theme);
    initNav();
    initMonthNavigation();
    initThemePanel();
    initTransactionModal();
    initBudgets();
    initChallenge();
    initSettings();
    initCSV();
    updateAllMonthDisplays();
    showRandomTip();
    refreshDashboard();

    setInterval(showRandomTip, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
