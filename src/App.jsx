import { useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, BriefcaseBusiness, Check,
  ChevronDown, CircleHelp, Clock3, Download, FileJson2, FileSpreadsheet, Gauge,
  FlaskConical, LayoutDashboard, Lightbulb, Menu, MessageCircle, Moon, Plus, Printer,
  Save, Search, Settings2, ShieldAlert, SlidersHorizontal, Sun, Target, Trash2,
  TrendingUp, Wallet, X, Zap,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  DEFAULT_INPUTS, DEFAULT_SCENARIOS, analyzeSensitivity, calculateCareer,
  comparePreparationPeriods, validateInputs,
} from './lib/careerModel.js';
import { simulateUncertainty } from './lib/uncertainty.js';
import { loadWorkspace, saveWorkspace } from './lib/workspaceStorage.js';
import './App.css';

const VARIABLE_FIELDS = [
  { key: 'salary', label: 'Current take-home salary', min: 0, max: 250000, step: 500, unit: '₹ / month', help: 'Monthly take-home income if you start a job now.' },
  { key: 'targetSalary', label: 'Salary after preparation', min: 0, max: 300000, step: 500, unit: '₹ / month', help: 'Target role salary; used as an estimate, not a guarantee.' },
  { key: 'expenses', label: 'Monthly living expenses', min: 0, max: 150000, step: 500, unit: '₹ / month', help: 'Rent, food, transport, bills, and essentials.' },
  { key: 'savings', label: 'Current savings', min: 0, max: 2000000, step: 5000, unit: '₹ today', help: 'Liquid savings you can access today.' },
  { key: 'prepMonths', label: 'Preparation before earning', min: 0, max: 36, step: 1, unit: 'months', help: 'Months without employment income while preparing.' },
  { key: 'learningBudget', label: 'Learning budget', min: 0, max: 50000, step: 500, unit: '₹ / month', help: 'Additional monthly preparation costs.' },
  { key: 'targetRoleProbability', label: 'Target role likelihood', min: 0, max: 100, step: 1, unit: '% (your estimate)', help: 'Your own assumption for the chance of reaching the target salary.' },
  { key: 'expectedSalaryGrowth', label: 'Annual salary growth', min: 0, max: 50, step: 1, unit: '% / year', help: 'Illustrative yearly growth after employment begins.' },
];

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'simulator', label: 'Decision simulator', icon: SlidersHorizontal },
  { id: 'comparison', label: 'Scenario comparison', icon: BarChart3 },
  { id: 'sensitivity', label: 'Sensitivity analysis', icon: Activity },
  { id: 'what-if', label: 'What-if analysis', icon: Zap },
  { id: 'risks', label: 'Risk analysis', icon: ShieldAlert },
  { id: 'uncertainty', label: 'Uncertainty lab', icon: FlaskConical },
  { id: 'goals', label: 'Goal tracking', icon: Target },
  { id: 'history', label: 'Decision history', icon: Clock3 },
  { id: 'copilot', label: 'Decision Copilot', icon: MessageCircle },
];

const CURRENCY_LOCALES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE' };
const COLORS = ['#62e3b2', '#86a9ff', '#ffc75e', '#e88abb', '#77c9e8', '#b69cff'];
const createId = () => globalThis.crypto?.randomUUID?.() ?? `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newScenario = (name, inputs = DEFAULT_INPUTS) => ({
  id: createId(),
  name,
  inputs: { ...inputs },
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function restoreScenarios(saved) {
  const defaults = () => DEFAULT_SCENARIOS.map((scenario) => ({
    ...scenario,
    inputs: { ...scenario.inputs },
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  if (!Array.isArray(saved)) return defaults();
  const valid = saved.filter((scenario) => {
    if (!scenario?.id || !scenario.name || !scenario.inputs) return false;
    try {
      validateInputs(scenario.inputs);
      return true;
    } catch {
      return false;
    }
  });
  return valid.length ? valid : defaults();
}

function restoreGoal(saved) {
  const allowedMetrics = ['endingBalance', 'monthlyCashFlow', 'runway'];
  return saved && allowedMetrics.includes(saved.metric) && Number.isFinite(saved.target) && saved.target > 0
    ? saved
    : { metric: 'endingBalance', target: 200000 };
}

function restoreHistory(saved) {
  if (!Array.isArray(saved)) return [];
  return saved.filter((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || !Number.isFinite(item.endingBalance) || !item.inputs) return false;
    try {
      validateInputs(item.inputs);
      return true;
    } catch {
      return false;
    }
  });
}

function formatMoney(value, currency = 'INR', compact = false) {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? 'en-IN', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'green', change }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}><Icon size={17} aria-hidden="true" /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span>{detail}</span>
        {change && <span className={`metric-change ${change.positive ? 'positive' : 'negative'}`}>
          {change.positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{change.text}
        </span>}
      </div>
    </article>
  );
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <div className="panel-heading">
        <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
        {action}
      </div>}
      {children}
    </section>
  );
}

function RiskPill({ level }) {
  const tone = level?.toLowerCase() ?? 'low';
  return <span className={`risk-pill risk-${tone}`}>{level ?? 'Low'} risk</span>;
}

function RangeControl({ field, value, currency, onChange }) {
  const percent = field.max === field.min ? 0 : ((value - field.min) / (field.max - field.min)) * 100;
  const display = field.unit.startsWith('₹') ? formatMoney(value, currency) : `${value}${field.unit.startsWith('%') ? '%' : ` ${field.unit}`}`;
  const labelId = `field-${field.key}`;
  return (
    <div className="field-control">
      <div className="field-topline">
        <label id={labelId} htmlFor={`${labelId}-number`}>{field.label}</label>
        <span className="field-value">{display}</span>
      </div>
      <input
        aria-labelledby={labelId}
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(event) => onChange(field.key, Number(event.target.value))}
        style={{ '--range-progress': `${percent}%` }}
      />
      <div className="field-bottomline">
        <span>{field.help}</span>
        <input
          id={`${labelId}-number`}
          aria-label={`${field.label} exact value`}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => event.target.value !== '' && onChange(field.key, Number(event.target.value))}
        />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatMoney(Number(entry.value), currency)}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [workspace] = useState(() => loadWorkspace());
  const [scenarios, setScenarios] = useState(() => restoreScenarios(workspace.scenarios));
  const [history, setHistory] = useState(() => restoreHistory(workspace.history));
  const [activeId, setActiveId] = useState(() => workspace.scenarios?.[0]?.id ?? 'balanced');
  const [page, setPage] = useState('overview');
  const [currency, setCurrency] = useState(Object.hasOwn(CURRENCY_LOCALES, workspace.preferences.currency) ? workspace.preferences.currency : 'INR');
  const [theme, setTheme] = useState(workspace.preferences.theme === 'light' ? 'light' : 'dark');
  const [workspaceName, setWorkspaceName] = useState(typeof workspace.preferences.workspaceName === 'string' && workspace.preferences.workspaceName.trim() ? workspace.preferences.workspaceName : 'Personal workspace');
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState(typeof workspace.preferences.workspaceName === 'string' && workspace.preferences.workspaceName.trim() ? workspace.preferences.workspaceName : 'Personal workspace');
  const [goal, setGoal] = useState(() => restoreGoal(workspace.preferences.goal));
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(workspace.error ?? '');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];
  const inputs = activeScenario?.inputs ?? DEFAULT_INPUTS;
  const results = useMemo(() => calculateCareer(inputs), [inputs]);
  const comparison = useMemo(() => comparePreparationPeriods(inputs), [inputs]);
  const sensitivities = useMemo(() => analyzeSensitivity(inputs), [inputs]);

  function updateWorkspace(changes) {
    const next = {
      scenarios: changes.scenarios ?? scenarios,
      history: changes.history ?? history,
      currency: changes.currency ?? currency,
      theme: changes.theme ?? theme,
      workspaceName: changes.workspaceName ?? workspaceName,
      goal: changes.goal ?? goal,
    };
    try {
      saveWorkspace(next.scenarios, next.history, {
        currency: next.currency,
        theme: next.theme,
        workspaceName: next.workspaceName,
        goal: next.goal,
      });
      if (changes.scenarios) setScenarios(next.scenarios);
      if (changes.history) setHistory(next.history);
      if (changes.currency) setCurrency(next.currency);
      if (changes.theme) setTheme(next.theme);
      if (changes.workspaceName) setWorkspaceName(next.workspaceName);
      if (changes.goal) setGoal(next.goal);
      setNotice('');
      return true;
    } catch (error) {
      setNotice(`Unable to save to this browser: ${error.message}`);
      return false;
    }
  }

  function updateInputs(key, value) {
    if (key === 'horizon') {
      if ([12, 24, 36].includes(value)) {
        updateWorkspace({ scenarios: scenarios.map((scenario) => scenario.id === activeScenario.id
          ? { ...scenario, inputs: { ...scenario.inputs, horizon: value }, updatedAt: new Date().toISOString() }
          : scenario) });
      }
      return;
    }
    const field = VARIABLE_FIELDS.find((item) => item.key === key);
    if (!field) return;
    if (!Number.isFinite(value)) {
      setNotice(`Enter a valid number for ${field.label.toLowerCase()}.`);
      return;
    }
    if (value < field.min || value > field.max) {
      setNotice(`${field.label} must be between ${field.min} and ${field.max}.`);
      return;
    }
    const nextValue = value;
    const updatedInputs = { ...inputs, [key]: nextValue };
    try {
      validateInputs(updatedInputs);
      const updatedScenarios = scenarios.map((scenario) => scenario.id === activeScenario.id
        ? { ...scenario, inputs: updatedInputs, updatedAt: new Date().toISOString() }
        : scenario);
      updateWorkspace({ scenarios: updatedScenarios });
    } catch (error) {
      setNotice(error.message);
    }
  }

  function createDecision() {
    const scenario = newScenario('New career decision', inputs);
    if (!updateWorkspace({ scenarios: [...scenarios, scenario] })) return;
    setActiveId(scenario.id);
    setPage('simulator');
    setNotice('Decision created and saved in this browser.');
  }

  function duplicateScenario(scenario = activeScenario) {
    const copy = newScenario(`${scenario.name} copy`, scenario.inputs);
    if (!updateWorkspace({ scenarios: [...scenarios, copy] })) return;
    setActiveId(copy.id);
    setNotice(`Created “${copy.name}”.`);
  }

  function renameScenario(scenario) {
    const name = window.prompt('Name this scenario', scenario.name);
    if (name === null) return;
    if (!name.trim()) {
      setNotice('A scenario name cannot be empty.');
      return;
    }
    updateWorkspace({ scenarios: scenarios.map((item) => item.id === scenario.id
      ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() }
      : item) });
  }

  function deleteScenario(scenario) {
    if (scenarios.length === 1) {
      setNotice('Keep at least one scenario in your workspace.');
      return;
    }
    if (!window.confirm(`Delete “${scenario.name}”? This cannot be undone.`)) return;
    const remaining = scenarios.filter((item) => item.id !== scenario.id);
    if (!updateWorkspace({ scenarios: remaining })) return;
    if (activeId === scenario.id) setActiveId(remaining[0].id);
  }

  function saveSnapshot(scenario = activeScenario) {
    const calculated = calculateCareer(scenario.inputs);
    if (!updateWorkspace({ history: [{
      id: createId(),
      scenarioId: scenario.id,
      name: scenario.name,
      category: 'Career',
      inputs: scenario.inputs,
      endingBalance: calculated.endingBalance,
      riskLevel: calculated.riskLevel,
      savedAt: new Date().toISOString(),
      modelVersion: 1,
    }, ...history].slice(0, 100) })) return;
    setNotice('Scenario snapshot saved to decision history.');
  }

  function restoreSnapshot(snapshot) {
    const currentScenario = scenarios.find((scenario) => scenario.id === snapshot.scenarioId);
    if (currentScenario) {
      if (!updateWorkspace({ scenarios: scenarios.map((scenario) => scenario.id === currentScenario.id
        ? { ...scenario, inputs: { ...snapshot.inputs }, updatedAt: new Date().toISOString() }
        : scenario) })) return;
      setActiveId(currentScenario.id);
    } else {
      const restored = newScenario(`${snapshot.name} restored`, snapshot.inputs);
      if (!updateWorkspace({ scenarios: [...scenarios, restored] })) return;
      setActiveId(restored.id);
    }
    setPage('simulator');
    setNotice(`Restored the saved inputs for “${snapshot.name}”.`);
  }

  function exportJson() {
    downloadFile('decision-lab-workspace.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      modelVersion: 1,
      workspace: workspaceName,
      preferences: { workspaceName, currency, theme, goal },
      scenarios,
      history,
    }, null, 2), 'application/json');
  }

  function exportCsv() {
    const rows = [
      ['Scenario', 'Current salary', 'Target salary', 'Monthly expenses', 'Savings', 'Preparation months', 'Learning budget', 'Target role likelihood (%)', 'Projection months', 'Expected total income', 'Total expenses', 'Projected ending balance', 'Runway months', 'Risk level'],
      ...scenarios.map((scenario) => {
        const result = calculateCareer(scenario.inputs);
        return [
          scenario.name, scenario.inputs.salary, scenario.inputs.targetSalary, scenario.inputs.expenses,
          scenario.inputs.savings, scenario.inputs.prepMonths, scenario.inputs.learningBudget,
          scenario.inputs.targetRoleProbability, scenario.inputs.horizon, Math.round(result.totalIncome),
          Math.round(result.totalExpenses + result.totalLearningCost), Math.round(result.endingBalance),
          result.runway === null ? 'Unlimited' : result.runway.toFixed(1), result.riskLevel,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    downloadFile('decision-lab-scenarios.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }

  function applyComparison(scenario) {
    const selected = scenarios.find((item) => item.id === activeId);
    if (!updateWorkspace({ scenarios: scenarios.map((item) => item.id === selected.id
      ? { ...item, inputs: { ...item.inputs, prepMonths: scenario.prepMonths }, updatedAt: new Date().toISOString() }
      : item) })) return;
    setPage('simulator');
    setNotice(`Applied ${scenario.name} to “${selected.name}”.`);
  }

  function applyWhatIf(changes) {
    const updatedInputs = { ...inputs, ...changes };
    try {
      validateInputs(updatedInputs);
      if (!updateWorkspace({ scenarios: scenarios.map((scenario) => scenario.id === activeScenario.id
        ? { ...scenario, inputs: updatedInputs, updatedAt: new Date().toISOString() }
        : scenario) })) return;
      setPage('simulator');
      setNotice('What-if assumptions applied to the active scenario.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  const filteredHistory = history.filter((item) => typeof item.name === 'string' && item.name.toLowerCase().includes(search.toLowerCase()));
  const title = NAV_ITEMS.find((item) => item.id === page)?.label ?? 'Overview';

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand-lockup" href="#overview" onClick={(event) => { event.preventDefault(); setPage('overview'); }}>
          <span className="brand-icon"><Activity size={19} /></span>
          <span><strong>Decision Lab</strong><small>INTELLIGENCE PLATFORM</small></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">P</span>
          <span className="workspace-copy"><small>WORKSPACE</small><strong>{workspaceName}</strong></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setMobileNavOpen(false); }}>
              <Icon size={17} aria-hidden="true" /><span>{label}</span>
              {id === 'risks' && results.risks.length > 0 && <span className="nav-count">{results.risks.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><Lightbulb size={15} /><span>Clear assumptions make better decisions.</span></div>
          <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); setMobileNavOpen(false); }}>
            <Settings2 size={17} /><span>Settings</span>
          </button>
          <div className="profile-block"><span className="profile-avatar">S</span><span><strong>Sohel Tadvi</strong><small>Personal account</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
            <div className="breadcrumbs"><span>{workspaceName}</span><span className="crumb-separator">/</span><strong>{title}</strong></div>
          </div>
          <div className="topbar-actions">
            <span className={`save-status ${notice.startsWith('Unable to') || notice.startsWith('Saved scenarios') ? 'save-error' : ''}`}><span className="save-dot" />{notice.startsWith('Unable to') || notice.startsWith('Saved scenarios') ? 'Save issue' : 'On this device'}</span>
            {currency !== 'INR' && <span className="currency-note">Display only · no FX conversion</span>}
            <button className="icon-button" title="Toggle color theme" aria-label="Toggle color theme" onClick={() => updateWorkspace({ theme: theme === 'dark' ? 'light' : 'dark' })}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="avatar-button" aria-label="User profile">S</button>
          </div>
        </header>

        <div className="content-area">
          {notice && <div className={`notice ${notice.startsWith('Unable') || notice.startsWith('Saved') ? 'notice-error' : ''}`} role="status">
            <CircleHelp size={15} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14} /></button>
          </div>}

          {page === 'overview' && <OverviewPage
            scenarios={scenarios} activeId={activeId} setActiveId={setActiveId}
            results={results} comparison={comparison} currency={currency} onCreate={createDecision}
            onExplore={() => setPage('simulator')} onDuplicate={duplicateScenario}
            onRename={renameScenario} onDelete={deleteScenario} onSave={saveSnapshot}
            onNavigate={setPage}
          />}
          {page === 'simulator' && <SimulatorPage
            scenario={activeScenario} scenarios={scenarios} results={results} currency={currency}
            updateInputs={updateInputs} onSelect={setActiveId}
            onDuplicate={duplicateScenario} onSave={saveSnapshot}
          />}
          {page === 'comparison' && <ComparisonPage
            scenarios={scenarios} activeId={activeId} inputs={inputs} currency={currency}
            onApply={applyComparison} onSelect={setActiveId} onCreate={createDecision}
          />}
          {page === 'sensitivity' && <SensitivityPage items={sensitivities} currency={currency} />}
          {page === 'what-if' && <WhatIfPage inputs={inputs} currency={currency} onApply={applyWhatIf} />}
          {page === 'risks' && <RiskPage inputs={inputs} results={results} currency={currency} />}
          {page === 'uncertainty' && <UncertaintyPage inputs={inputs} currency={currency} />}
          {page === 'goals' && <GoalPage inputs={inputs} results={results} goal={goal} onSave={(value) => updateWorkspace({ goal: value })} currency={currency} />}
          {page === 'history' && <HistoryPage
            items={filteredHistory} search={search} setSearch={setSearch}
            onRestore={restoreSnapshot}
            currency={currency}
          />}
          {page === 'copilot' && <CopilotPage inputs={inputs} results={results} currency={currency} />}
          {page === 'settings' && <SettingsPage
            workspaceName={workspaceNameDraft} setWorkspaceName={setWorkspaceNameDraft}
            currency={currency} setCurrency={(value) => updateWorkspace({ currency: value })}
            onSaveName={() => updateWorkspace({ workspaceName: workspaceNameDraft.trim() || workspaceName })}
            onJson={exportJson} onCsv={exportCsv} onPrint={() => window.print()}
          />}
          <footer className="app-footer">
            <span>DECISION INTELLIGENCE LAB</span>
            <span>Illustrative models only · Your scenarios stay in this browser</span>
            <div className="footer-export">
              <button onClick={exportCsv}><FileSpreadsheet size={13} /> CSV</button>
              <button onClick={exportJson}><FileJson2 size={13} /> JSON</button>
              <button onClick={() => window.print()}><Printer size={13} /> Print</button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, actions }) {
  return (
    <div className="page-intro">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="intro-actions">{actions}</div>}
    </div>
  );
}

function OverviewPage({ scenarios, activeId, setActiveId, results, comparison, currency, onCreate, onExplore, onDuplicate, onRename, onDelete, onSave, onNavigate }) {
  const comparisonData = comparison.map((item) => ({ ...item, displayName: item.name }));
  const scatterData = comparison.map((item) => ({ x: item.prepMonths, y: item.endingBalance, name: item.name }));
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];
  return (
    <>
      <PageIntro
        eyebrow="DECISION OVERVIEW"
        title="Model your options. Understand the trade-offs."
        description="Explore how your assumptions shape a career decision. Projections are illustrative, editable estimates—not predictions."
        actions={<><button className="button button-secondary" onClick={onExplore}><BriefcaseBusiness size={15} />Explore example</button><button className="button button-primary" onClick={onCreate}><Plus size={16} />Create decision</button></>}
      />
      <div className="section-heading"><div><h2>Active decision</h2><p>{scenarios.length} scenarios in your workspace</p></div>
        <ScenarioSelect scenarios={scenarios} activeId={activeId} onSelect={setActiveId} />
      </div>
      <div className="metric-grid">
        <MetricCard label="Active scenario" value={activeScenario.name} detail="Career decision model" icon={BriefcaseBusiness} tone="blue" />
        <MetricCard label="Top projected scenario" value={comparison.reduce((best, item) => item.endingBalance > best.endingBalance ? item : best, comparison[0]).name} detail="Highest modeled cash balance" icon={Gauge} tone="purple" />
        <MetricCard label="Projected outcome" value={formatMoney(results.endingBalance, currency, true)} detail={`Estimated balance · ${results.horizon} months`} icon={Wallet} tone={results.endingBalance < 0 ? 'red' : 'green'} />
        <MetricCard label="Risk level" value={<RiskPill level={results.riskLevel} />} detail={`${results.risks.length} modeled risk flags`} icon={ShieldAlert} tone={results.riskLevel === 'Low' ? 'green' : 'amber'} />
        <MetricCard label="Income coverage" value={`${Math.round(results.earningMonths / results.horizon * 100)}%`} detail="Projection months with income" icon={Activity} tone="blue" />
        <MetricCard label="Last updated" value={formatDate(scenarios.find((item) => item.id === activeId)?.updatedAt)} detail="Saved in this browser" icon={Clock3} tone="amber" />
      </div>
      <div className="content-grid two-column">
        <Panel title="Preparation trade-off" subtitle="Projected ending cash by preparation plan" action={<button className="text-button" onClick={() => onNavigate('comparison')}>Compare all <ArrowUpRight size={14} /></button>}>
          <div className="chart-wrap chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="displayName" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => formatMoney(value, currency, true)} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
                <Bar dataKey="endingBalance" name="Ending balance" radius={[5, 5, 0, 0]} maxBarSize={54}>
                  {comparisonData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Preparation time vs. modeled outcome" subtitle="Explore projected cash balance across alternative preparation periods">
          <div className="chart-wrap chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="var(--chart-grid)" />
                <XAxis type="number" dataKey="x" name="Preparation" unit=" mo" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="number" dataKey="y" name="Ending balance" tickFormatter={(value) => formatMoney(value, currency, true)} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [name === 'Ending balance' ? formatMoney(value, currency) : `${value} months`, name]} />
                <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
                <Scatter name="Preparation scenarios" data={scatterData} fill="#62e3b2">
                  {scatterData.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Recent decisions" subtitle="Open, save, or manage your local scenario versions" action={<button className="text-button" onClick={() => onNavigate('history')}>View history <ArrowUpRight size={14} /></button>}>
        <ScenarioTable scenarios={scenarios} activeId={activeId} setActiveId={setActiveId} currency={currency} onDuplicate={onDuplicate} onRename={onRename} onDelete={onDelete} onSave={onSave} />
      </Panel>
      <Panel title="Decision snapshot" subtitle={results.recommendation.evidence} className="recommendation-panel">
        <div className="recommendation-content">
          <div className="recommendation-icon"><Lightbulb size={18} /></div>
          <div><h3>{results.recommendation.title}</h3><p>{results.recommendation.summary}</p><p className="tradeoff-copy"><strong>Trade-off:</strong> {results.recommendation.tradeoff}</p><p className="next-step"><Check size={14} />{results.recommendation.nextStep}</p></div>
          <RiskPill level={results.riskLevel} />
        </div>
      </Panel>
    </>
  );
}

function ScenarioSelect({ scenarios, activeId, onSelect }) {
  return <label className="scenario-select-label"><span>ACTIVE SCENARIO</span><select value={activeId} onChange={(event) => onSelect(event.target.value)} aria-label="Select active scenario">
    {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
  </select></label>;
}

function ScenarioTable({ scenarios, activeId, setActiveId, currency, onDuplicate, onRename, onDelete, onSave }) {
  return (
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Decision name</th><th>Preparation</th><th>Ending balance</th><th>Risk</th><th>Updated</th><th className="actions-cell">Actions</th></tr></thead>
      <tbody>{scenarios.map((scenario) => {
        const result = calculateCareer(scenario.inputs);
        return <tr key={scenario.id} className={scenario.id === activeId ? 'selected-row' : ''}>
          <td><button className="scenario-name-button" onClick={() => setActiveId(scenario.id)}><span className="table-icon"><BriefcaseBusiness size={15} /></span><span><strong>{scenario.name}</strong><small>Career decision</small></span></button></td>
          <td>{scenario.inputs.prepMonths} months</td><td className={result.endingBalance < 0 ? 'negative-value' : 'positive-value'}>{formatMoney(result.endingBalance, currency)}</td><td><RiskPill level={result.riskLevel} /></td><td>{formatDate(scenario.updatedAt)}</td>
          <td><div className="row-actions">
            <button title="Save history snapshot" aria-label={`Save ${scenario.name} snapshot`} onClick={() => onSave(scenario)}><Save size={14} /></button>
            <button title="Duplicate" aria-label={`Duplicate ${scenario.name}`} onClick={() => onDuplicate(scenario)}><Plus size={14} /></button>
            <button title="Rename" aria-label={`Rename ${scenario.name}`} onClick={() => onRename(scenario)}><Settings2 size={14} /></button>
            <button title="Delete" aria-label={`Delete ${scenario.name}`} onClick={() => onDelete(scenario)}><Trash2 size={14} /></button>
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>
  );
}

function SimulatorPage({ scenario, scenarios, results, currency, updateInputs, onSelect, onDuplicate, onSave }) {
  const projections = [12, 24, 36].map((horizon) => {
    const result = calculateCareer({ ...scenario.inputs, horizon });
    return { horizon: `${horizon} mo`, endingBalance: result.endingBalance, totalIncome: result.totalIncome };
  });
  return (
    <>
      <PageIntro eyebrow="CAREER DECISION MODEL" title={scenario.name} description="Change an assumption to immediately recalculate cash flow, risk, and the modeled outcome." actions={<><button className="button button-secondary" onClick={onDuplicate}><Plus size={15} />Duplicate</button><button className="button button-primary" onClick={() => onSave()}><Save size={15} />Save snapshot</button></>} />
      <div className="simulator-toolbar"><ScenarioSelect scenarios={scenarios} activeId={scenario.id} onSelect={onSelect} /><label className="horizon-select">PROJECTION PERIOD<select value={scenario.inputs.horizon} onChange={(event) => updateInputs('horizon', Number(event.target.value))}><option value={12}>12 months</option><option value={24}>24 months</option><option value={36}>36 months</option></select></label><span className="assumption-note"><CircleHelp size={14} /> Estimates use your inputs and a weighted target-salary assumption.</span></div>
      <div className="metric-grid four-metrics">
        <MetricCard label="Projected ending balance" value={formatMoney(results.endingBalance, currency, true)} detail={`After ${results.horizon} months`} icon={Wallet} tone={results.endingBalance < 0 ? 'red' : 'green'} />
        <MetricCard label="Total income" value={formatMoney(results.totalIncome, currency, true)} detail={`${results.earningMonths} modeled earning months`} icon={TrendingUp} tone="blue" />
        <MetricCard label="Total expenses" value={formatMoney(results.totalExpenses + results.totalLearningCost, currency, true)} detail="Living + preparation costs" icon={BarChart3} tone="amber" />
        <MetricCard label="Financial runway" value={results.runway === null ? 'Unlimited' : `${results.runway.toFixed(1)} mo`} detail="Savings ÷ living expenses" icon={Gauge} tone={results.runway !== null && results.runway < scenario.inputs.prepMonths ? 'red' : 'green'} />
      </div>
      <div className="content-grid simulator-grid">
        <Panel title="Shape your assumptions" subtitle="Drag each slider or enter a precise value. The model updates locally." className="assumptions-panel">
          <div className="field-list">{VARIABLE_FIELDS.map((field) => <RangeControl key={field.key} field={field} value={scenario.inputs[field.key]} currency={currency} onChange={updateInputs} />)}</div>
          <div className="model-note"><CircleHelp size={15} /><span>After preparation, income uses a weighted average of your current salary and target salary based on the likelihood you entered. It is not a job-offer forecast.</span></div>
        </Panel>
        <div className="simulator-results">
          <Panel title="Cash balance projection" subtitle={`Month-by-month estimate · ${scenario.inputs.horizon} months`}>
            <div className="chart-wrap chart-large">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results.timeline} margin={{ top: 12, right: 18, bottom: 2, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" interval="preserveStartEnd" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => formatMoney(value, currency, true)} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
                  {scenario.inputs.prepMonths > 0 && scenario.inputs.prepMonths <= scenario.inputs.horizon && <ReferenceLine x={`M${scenario.inputs.prepMonths}`} stroke="#ffc75e" strokeDasharray="4 4" label={{ value: 'Income starts', fill: '#ffc75e', fontSize: 10, position: 'insideTopRight' }} />}
                  <Line type="monotone" dataKey="balance" name="Cash balance" stroke="#62e3b2" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="12, 24, and 36 month view" subtitle="Same assumptions, different projection horizons">
            <div className="chart-wrap chart-small">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projections} margin={{ top: 8, right: 14, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="horizon" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => formatMoney(value, currency, true)} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
                  <Bar dataKey="endingBalance" name="Ending balance" fill="#86a9ff" radius={[5, 5, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Recommendation & trade-offs" subtitle={results.recommendation.evidence} className="recommendation-panel">
            <div className="recommendation-content">
              <div className="recommendation-icon"><Lightbulb size={18} /></div>
              <div><h3>{results.recommendation.title}</h3><p>{results.recommendation.summary}</p><p className="tradeoff-copy"><strong>Trade-off:</strong> {results.recommendation.tradeoff}</p><p className="next-step"><Check size={14} />{results.recommendation.nextStep}</p></div><RiskPill level={results.riskLevel} />
            </div>
          </Panel>
          <div className="metric-grid two-metrics">
            <MetricCard label="Monthly cash flow after work begins" value={formatMoney(results.monthlyCashFlow, currency)} detail="Expected monthly income − expenses" icon={Activity} tone={results.monthlyCashFlow < 0 ? 'red' : 'green'} />
            <MetricCard label="Break-even vs. starting now" value={results.breakEvenMonth ? `Month ${results.breakEvenMonth}` : 'Not reached'} detail="Estimated recovery of foregone income + learning costs" icon={Clock3} tone="blue" />
          </div>
        </div>
      </div>
    </>
  );
}

function ComparisonPage({ scenarios, activeId, inputs, currency, onApply, onSelect, onCreate }) {
  const plans = comparePreparationPeriods(inputs);
  const savedComparison = scenarios.map((scenario) => ({
    ...calculateCareer(scenario.inputs),
    id: scenario.id,
    name: scenario.name,
    prepMonths: scenario.inputs.prepMonths,
    inputs: scenario.inputs,
  }));
  return (
    <>
      <PageIntro eyebrow="SCENARIO COMPARISON" title="Compare paths side by side" description="Every result below is recalculated from the inputs in that scenario. Apply a preparation plan to your active scenario to explore it further." actions={<button className="button button-primary" onClick={onCreate}><Plus size={15} />Add scenario</button>} />
      <Panel title="Preparation plans" subtitle="Alternative preparation durations using the active scenario’s other assumptions">
        <div className="table-scroll"><table className="data-table comparison-table">
          <thead><tr><th>Plan</th><th>Income after prep</th><th>Total modeled income</th><th>Ending balance</th><th>Runway</th><th>Risk</th><th /></tr></thead>
          <tbody>{plans.map((item) => <tr key={item.prepMonths} className={item.prepMonths === inputs.prepMonths ? 'selected-row' : ''}>
            <td><strong>{item.name}</strong><small className="table-subline">{item.prepMonths} months without job income</small></td>
            <td>{formatMoney(item.expectedMonthlySalary, currency)}/mo</td><td>{formatMoney(item.totalIncome, currency)}</td>
            <td className={item.endingBalance < 0 ? 'negative-value' : 'positive-value'}>{formatMoney(item.endingBalance, currency)}</td>
            <td>{item.runway === null ? 'Unlimited' : `${item.runway.toFixed(1)} mo`}</td><td><RiskPill level={item.riskLevel} /></td>
            <td><button className="button button-small button-secondary" onClick={() => onApply(item)}>Apply plan</button></td>
          </tr>)}</tbody>
        </table></div>
      </Panel>
      <Panel title="Saved scenario comparison" subtitle="Saved scenarios stay independent; editing the active one will not change the others">
        <div className="chart-wrap chart-medium">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={savedComparison} margin={{ top: 8, right: 14, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value) => formatMoney(value, currency, true)} />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 4" />
              <Bar dataKey="endingBalance" name="Ending balance" fill="#62e3b2" radius={[5, 5, 0, 0]} />
              <Bar dataKey="totalIncome" name="Total income" fill="#86a9ff" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-scroll"><table className="data-table comparison-table">
          <thead><tr><th>Metric</th>{savedComparison.map((item) => <th key={item.id}><button className="scenario-name-button" onClick={() => onSelect(item.id)}>{item.name}{item.id === activeId && <span className="active-tag">Active</span>}</button></th>)}</tr></thead>
          <tbody>
            <ComparisonRow label="Monthly salary" scenarios={savedComparison} getValue={(item) => formatMoney(item.inputs.salary, currency)} />
            <ComparisonRow label="Monthly expenses" scenarios={savedComparison} getValue={(item) => formatMoney(item.inputs.expenses, currency)} />
            <ComparisonRow label="Preparation duration" scenarios={savedComparison} getValue={(item) => `${item.prepMonths} months`} />
            <ComparisonRow label="Total income" scenarios={savedComparison} getValue={(item) => formatMoney(item.totalIncome, currency)} />
            <ComparisonRow label="Ending balance" scenarios={savedComparison} getValue={(item) => formatMoney(item.endingBalance, currency)} />
            <ComparisonRow label="Break-even" scenarios={savedComparison} getValue={(item) => item.breakEvenMonth ? `Month ${item.breakEvenMonth}` : 'Not reached'} />
            <ComparisonRow label="Risk level" scenarios={savedComparison} getValue={(item) => item.riskLevel} />
          </tbody>
        </table></div>
      </Panel>
    </>
  );
}

function ComparisonRow({ label, scenarios, getValue }) {
  return <tr><th scope="row">{label}</th>{scenarios.map((scenario) => <td key={scenario.id}>{getValue(scenario)}</td>)}</tr>;
}

function SensitivityPage({ items, currency }) {
  const labels = { salary: 'Current salary ±20%', expenses: 'Monthly expenses ±20%', savings: 'Starting savings ±20%', prepMonths: 'Preparation time ±3 mo' };
  const chartData = items.map((item) => ({
    name: labels[item.variable],
    decrease: Math.round(item.lowOutcome - item.baseline),
    increase: Math.round(item.highOutcome - item.baseline),
    swing: Math.round(item.impact),
  }));
  return (
    <>
      <PageIntro eyebrow="SENSITIVITY ANALYSIS" title="Which assumptions move the outcome?" description="Sensitivity shows how much the projected balance changes across the selected input ranges. It measures impact—not the likelihood that an input will change." />
      <Panel title="Outcome impact ranking" subtitle="Low and high input values are compared with the current scenario baseline">
        <div className="chart-wrap chart-large">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, bottom: 0, left: 24 }}>
              <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
              <XAxis type="number" tickFormatter={(value) => formatMoney(value, currency, true)} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(value) => formatMoney(value, currency)} />
              <ReferenceLine x={0} stroke="var(--text-muted)" />
              <Bar dataKey="decrease" name="Low input vs. baseline" fill="#f3a77c" radius={[0, 4, 4, 0]} />
              <Bar dataKey="increase" name="High input vs. baseline" fill="#62e3b2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Calculated sensitivity" subtitle="Largest modeled outcome swing first">
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Input</th><th>Low input outcome</th><th>Current outcome</th><th>High input outcome</th><th>Impact range</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.variable}><td><strong>{labels[item.variable]}</strong></td><td>{formatMoney(item.lowOutcome, currency)}</td><td>{formatMoney(item.baseline, currency)}</td><td>{formatMoney(item.highOutcome, currency)}</td><td className="positive-value">{formatMoney(item.impact, currency)}</td></tr>)}</tbody>
        </table></div>
      </Panel>
    </>
  );
}

function WhatIfPage({ inputs, currency, onApply }) {
  const [salaryChange, setSalaryChange] = useState(20);
  const [expenseChange, setExpenseChange] = useState(15);
  const [extraPreparation, setExtraPreparation] = useState(3);
  const changes = {
    salary: Math.min(250000, Math.max(0, inputs.salary * (1 + salaryChange / 100))),
    targetSalary: Math.min(300000, Math.max(0, inputs.targetSalary * (1 + salaryChange / 100))),
    expenses: Math.min(150000, Math.max(0, inputs.expenses * (1 + expenseChange / 100))),
    prepMonths: Math.min(36, inputs.prepMonths + extraPreparation),
  };
  const baseline = calculateCareer(inputs);
  const modified = calculateCareer({ ...inputs, ...changes });
  const difference = modified.endingBalance - baseline.endingBalance;
  const impactItems = [
    { name: 'Salary adjustment', value: calculateCareer({ ...inputs, salary: changes.salary, targetSalary: changes.targetSalary }).endingBalance - baseline.endingBalance },
    { name: 'Expense adjustment', value: calculateCareer({ ...inputs, expenses: changes.expenses }).endingBalance - baseline.endingBalance },
    { name: 'Preparation delay', value: calculateCareer({ ...inputs, prepMonths: changes.prepMonths }).endingBalance - baseline.endingBalance },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return (
    <>
      <PageIntro eyebrow="WHAT-IF ANALYSIS" title="Test changes before you commit" description="Combine several adjustments and see the difference against your current baseline. These are scenario comparisons, not predictions." />
      <div className="what-if-grid">
        <Panel title="Adjust the assumptions" subtitle="You can change multiple values at once">
          <div className="what-if-controls">
            <label><span>Salary change</span><strong>{salaryChange > 0 ? '+' : ''}{salaryChange}%</strong><input type="range" min={-50} max={100} step={5} value={salaryChange} onChange={(event) => setSalaryChange(Number(event.target.value))} /><small>Applies to current and target salary estimates.</small></label>
            <label><span>Expense increase</span><strong>+{expenseChange}%</strong><input type="range" min={0} max={100} step={5} value={expenseChange} onChange={(event) => setExpenseChange(Number(event.target.value))} /><small>Applied to monthly living expenses.</small></label>
            <label><span>Additional preparation time</span><strong>+{extraPreparation} months</strong><input type="range" min={0} max={12} step={1} value={extraPreparation} onChange={(event) => setExtraPreparation(Number(event.target.value))} /><small>Added to your current preparation period.</small></label>
            <div className="what-if-actions"><button className="button button-primary" onClick={() => onApply(changes)}><Check size={15} />Apply this scenario</button><span>Changes are applied only when you choose to apply them.</span></div>
          </div>
        </Panel>
        <div className="what-if-results">
          <Panel title="Baseline vs. modified outcome" subtitle={`${inputs.horizon}-month cash balance`}>
            <div className="what-if-comparison">
              <div><span>Baseline</span><strong>{formatMoney(baseline.endingBalance, currency)}</strong></div>
              <div className="what-if-arrow"><ArrowUpRight size={18} /></div>
              <div><span>Modified</span><strong className={difference >= 0 ? 'positive-value' : 'negative-value'}>{formatMoney(modified.endingBalance, currency)}</strong></div>
            </div>
            <div className="difference-callout"><span>Change in modeled outcome</span><strong className={difference >= 0 ? 'positive-value' : 'negative-value'}>{difference > 0 ? '+' : ''}{formatMoney(difference, currency)}</strong><small>{baseline.endingBalance === 0 ? 'Percentage change unavailable when baseline is zero.' : `${((difference / Math.abs(baseline.endingBalance)) * 100).toFixed(1)}% vs. baseline`}</small></div>
          </Panel>
          <Panel title="Impact ranking" subtitle="Each adjustment tested independently against the baseline">
            <div className="impact-list">{impactItems.map((item, index) => <div key={item.name} className="impact-row"><span className="impact-rank">{index + 1}</span><span>{item.name}</span><strong className={item.value >= 0 ? 'positive-value' : 'negative-value'}>{item.value > 0 ? '+' : ''}{formatMoney(item.value, currency)}</strong></div>)}</div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function UncertaintyPage({ inputs, currency }) {
  const [count, setCount] = useState(1000);
  const [seed, setSeed] = useState(42);
  const [distribution, setDistribution] = useState('uniform');
  const [salaryLow, setSalaryLow] = useState(Math.round(inputs.salary * 0.8));
  const [salaryHigh, setSalaryHigh] = useState(Math.min(250000, Math.round(inputs.salary * 1.2)));
  const [expenseLow, setExpenseLow] = useState(Math.round(inputs.expenses * 0.9));
  const [expenseHigh, setExpenseHigh] = useState(Math.min(150000, Math.round(inputs.expenses * 1.1)));
  const [prepLow, setPrepLow] = useState(Math.max(0, inputs.prepMonths - 2));
  const [prepHigh, setPrepHigh] = useState(Math.min(36, inputs.prepMonths + 2));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const baseline = calculateCareer(inputs);

  function runSimulation() {
    try {
      const simulation = simulateUncertainty(inputs, {
        count,
        seed,
        distribution,
        salaryRange: [salaryLow, salaryHigh],
        expensesRange: [expenseLow, expenseHigh],
        prepRange: [prepLow, prepHigh],
      });
      setResult(simulation);
      setError('');
    } catch (simulationError) {
      setError(simulationError.message);
    }
  }

  return (
    <>
      <PageIntro eyebrow="UNCERTAINTY LAB" title="Explore a range of possible outcomes" description="Run a seeded simulation using ranges you choose. Results describe only the assumptions entered here; they are not calibrated real-world probabilities." />
      <div className="uncertainty-layout">
        <Panel title="Simulation assumptions" subtitle="Uniform, triangular, or truncated normal sampling">
          <div className="uncertainty-form">
            <label>Distribution<select value={distribution} onChange={(event) => setDistribution(event.target.value)}><option value="uniform">Uniform</option><option value="triangular">Triangular (mode at midpoint)</option><option value="normal">Normal (mean at midpoint)</option></select></label>
            <label>Runs<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={1000}>1,000</option><option value={5000}>5,000</option><option value={10000}>10,000</option></select></label>
            <label>Seed<input type="number" min={0} value={seed} onChange={(event) => event.target.value !== '' && setSeed(Number(event.target.value))} /></label>
            <RangePair label="Current salary range" low={salaryLow} high={salaryHigh} setLow={setSalaryLow} setHigh={setSalaryHigh} step={500} max={250000} currency={currency} />
            <RangePair label="Monthly expense range" low={expenseLow} high={expenseHigh} setLow={setExpenseLow} setHigh={setExpenseHigh} step={500} max={150000} currency={currency} />
            <RangePair label="Preparation duration range" low={prepLow} high={prepHigh} setLow={setPrepLow} setHigh={setPrepHigh} step={1} max={36} unit="months" />
            <button className="button button-primary run-button" onClick={runSimulation}><FlaskConical size={15} />Run simulation</button>
            {error && <div className="inline-error" role="alert">{error}</div>}
          </div>
        </Panel>
        <div className="uncertainty-results">
          {result ? <>
            <div className="metric-grid uncertainty-metrics">
              <MetricCard label="Median outcome" value={formatMoney(result.median, currency, true)} detail={`Baseline ${formatMoney(baseline.endingBalance, currency, true)}`} icon={Gauge} tone="green" />
              <MetricCard label="10th percentile" value={formatMoney(result.percentile10, currency, true)} detail="Lower-tail modeled outcome" icon={ArrowDownRight} tone="amber" />
              <MetricCard label="90th percentile" value={formatMoney(result.percentile90, currency, true)} detail="Upper-tail modeled outcome" icon={ArrowUpRight} tone="blue" />
              <MetricCard label="Negative balance share" value={`${result.negativeBalancePercent.toFixed(1)}%`} detail="Of this assumption-based simulation" icon={ShieldAlert} tone={result.negativeBalancePercent > 0 ? 'red' : 'green'} />
            </div>
            <Panel title="Simulated ending balances" subtitle={`${result.count.toLocaleString()} ${result.distribution} samples · seed ${result.seed}`}>
              <div className="chart-wrap chart-medium">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.histogram} margin={{ top: 8, right: 12, bottom: 0, left: 3 }}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="range" interval={3} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                    <Tooltip formatter={(value) => [`${value} runs`, 'Count']} />
                    <ReferenceLine x={result.histogram.find((bin) => bin.midpoint >= 0)?.range} stroke="#f87171" strokeDasharray="4 4" />
                    <Bar dataKey="count" name="Simulation count" fill="#86a9ff" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </> : <Panel title="Simulation results" subtitle="Choose ranges and run a simulation">
            <div className="empty-state"><FlaskConical size={20} /><strong>No simulation run yet</strong><span>Results are reproducible for the same inputs, distribution, run count, and seed.</span></div>
          </Panel>}
          <div className="model-note"><CircleHelp size={15} /><span>These percentiles summarize the consequences of your entered assumptions. They are not an estimated probability of receiving a job offer or any other real-world event.</span></div>
        </div>
      </div>
    </>
  );
}

function RangePair({ label, low, high, setLow, setHigh, step, max, currency, unit = '' }) {
  const formatValue = (value) => unit ? `${value} ${unit}` : formatMoney(value, currency);
  return <div className="range-pair"><strong>{label}</strong><div><label>Min<input type="number" min={0} max={max} step={step} value={low} onChange={(event) => event.target.value !== '' && setLow(Number(event.target.value))} /></label><span>to</span><label>Max<input type="number" min={0} max={max} step={step} value={high} onChange={(event) => event.target.value !== '' && setHigh(Number(event.target.value))} /></label></div><small>{formatValue(low)} – {formatValue(high)}</small></div>;
}

function GoalPage({ inputs, results, goal, onSave, currency }) {
  const [metric, setMetric] = useState(goal.metric);
  const [target, setTarget] = useState(Number.isFinite(goal.target) && goal.target > 0 ? goal.target : 200000);
  const values = {
    endingBalance: { label: 'Projected ending balance', current: results.endingBalance, unit: currency },
    monthlyCashFlow: { label: 'Monthly cash flow', current: results.monthlyCashFlow, unit: currency },
    runway: { label: 'Financial runway', current: results.runway ?? Number.POSITIVE_INFINITY, unit: 'months' },
  };
  const selected = values[metric];
  const progress = Number.isFinite(selected.current) && target > 0
    ? Math.max(0, Math.min(100, selected.current / target * 100))
    : selected.current === Number.POSITIVE_INFINITY ? 100 : 0;
  const remaining = target - selected.current;
  const canEstimateTime = metric === 'endingBalance' && remaining > 0 && results.monthlyCashFlow > 0;
  const monthsToTarget = canEstimateTime ? inputs.horizon + Math.ceil(remaining / results.monthlyCashFlow) : null;
  const formatGoalValue = (value) => metric === 'runway' && Number.isFinite(value)
    ? `${value.toFixed(1)} months`
    : formatMoney(value, currency);
  return (
    <>
      <PageIntro eyebrow="GOAL TRACKING" title="Turn a target into a measurable milestone" description="Track progress against your current modeled result. Time estimates are shown only when the model has a positive monthly cash flow to extend." />
      <div className="goal-layout">
        <Panel title="Set a goal" subtitle="Your target is stored in this browser">
          <div className="goal-form"><label>Metric<select value={metric} onChange={(event) => setMetric(event.target.value)}><option value="endingBalance">Projected ending balance</option><option value="monthlyCashFlow">Monthly cash flow after work begins</option><option value="runway">Financial runway</option></select></label><label>Target {values[metric].unit === 'months' ? '(months)' : `(${currency})`}<input type="number" min={1} value={target} onChange={(event) => event.target.value !== '' && Number.isFinite(Number(event.target.value)) && setTarget(Math.max(1, Number(event.target.value)))} /></label><button className="button button-primary" onClick={() => onSave({ metric, target })}><Target size={15} />Save goal</button></div>
        </Panel>
        <Panel title="Goal progress" subtitle="Updated from the current active scenario">
          <div className="goal-progress-heading"><span>{selected.label}</span><span className="goal-status">{progress >= 100 ? 'Target met' : 'In progress'}</span></div>
          <div className="goal-progress-values"><strong>{Number.isFinite(selected.current) ? formatGoalValue(selected.current) : 'Unlimited'}</strong><span>of {formatGoalValue(target)}</span></div>
          <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Goal progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="goal-foot"><span>{progress.toFixed(0)}% progress</span><span>{canEstimateTime ? `About ${monthsToTarget} months at current modeled cash flow` : progress >= 100 ? 'Target reached in this scenario' : 'Time to target unavailable for these assumptions'}</span></div>
        </Panel>
      </div>
      <Panel title="Required progress" subtitle="Simple target difference over the selected projection horizon">
        <div className="goal-requirement"><div><span>Remaining to target</span><strong>{remaining > 0 && Number.isFinite(remaining) ? formatGoalValue(remaining) : 'Target reached'}</strong></div><div><span>Required monthly progress</span><strong>{remaining > 0 && Number.isFinite(remaining) ? formatGoalValue(remaining / inputs.horizon) : '—'}<small> over {inputs.horizon} months</small></strong></div><div><span>Current modeled monthly cash flow</span><strong>{formatMoney(results.monthlyCashFlow, currency)}</strong></div></div>
      </Panel>
    </>
  );
}

function CopilotPage({ inputs, results, currency }) {
  const suggestions = ['Why does this scenario perform this way?', 'What is the biggest financial risk?', 'Which input has the greatest impact?', 'How could I improve this modeled outcome?'];
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  function ask(value) {
    const prompt = value.trim();
    if (!prompt) return;
    const sensitivity = analyzeSensitivity(inputs);
    const leadingInput = sensitivity[0];
    let response;
    if (/risk|danger|problem/i.test(prompt)) {
      response = results.risks.length
        ? `The current model flags ${results.risks[0].title.toLowerCase()} (${results.risks[0].severity.toLowerCase()}). ${results.risks[0].explanation} One possible mitigation: ${results.risks[0].mitigation}`
        : 'No configured risk thresholds were triggered by the current inputs. That does not guarantee a safe outcome; stress-test a lower salary, higher expenses, and a longer preparation period.';
    } else if (/impact|variable|sensitive|greatest/i.test(prompt)) {
      response = `${leadingInput.variable} has the largest outcome swing in the tested ranges: ${formatMoney(leadingInput.impact, currency)} between low and high inputs. Sensitivity measures impact, not how likely the input is to change.`;
    } else if (/improve|better|increase/i.test(prompt)) {
      const alternatives = comparePreparationPeriods(inputs);
      const best = alternatives.reduce((winner, item) => item.endingBalance > winner.endingBalance ? item : winner, alternatives[0]);
      response = `Among the 0, 3, 6, and 12 month preparation alternatives, “${best.name}” gives the highest modeled ending balance (${formatMoney(best.endingBalance, currency)}). The best financial result may trade off against time available for preparation; these alternatives use your assumptions.`;
    } else {
      response = `Your current ${inputs.horizon}-month model estimates total income of ${formatMoney(results.totalIncome, currency)}, expenses and learning costs of ${formatMoney(results.totalExpenses + results.totalLearningCost, currency)}, and an ending cash balance of ${formatMoney(results.endingBalance, currency)}. The projected salary after preparation is assumption-based, not guaranteed.`;
    }
    setMessages((current) => [...current, { id: createId(), question: prompt, response }]);
    setQuestion('');
  }
  return (
    <>
      <PageIntro eyebrow="DECISION COPILOT · RULE-BASED" title="Ask about your current scenario" description="This local assistant uses transparent model calculations only. No external AI service is configured, and no data leaves your browser." />
      <div className="copilot-layout">
        <Panel title="Suggested questions" subtitle="Each response refers to the current scenario">
          <div className="suggestion-list">{suggestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}<ArrowUpRight size={14} /></button>)}</div>
          <div className="model-note"><CircleHelp size={15} /><span>Rule-based assistant. Responses are not professional financial or career advice.</span></div>
        </Panel>
        <Panel title="Decision Copilot" subtitle="Current scenario · calculations run locally">
          <div className="chat-log" aria-live="polite">
            {!messages.length && <div className="empty-state"><MessageCircle size={20} /><strong>Ask a question to get started</strong><span>Use a suggested prompt or write your own.</span></div>}
            {messages.map((item) => <article className="chat-turn" key={item.id}><div className="chat-question"><span>You</span><p>{item.question}</p></div><div className="chat-answer"><span>Decision Copilot · rule-based</span><p>{item.response}</p></div></article>)}
          </div>
          <form className="chat-form" onSubmit={(event) => { event.preventDefault(); ask(question); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about the modeled results…" aria-label="Ask Decision Copilot" /><button className="button button-primary" type="submit" disabled={!question.trim()}>Ask</button></form>
        </Panel>
      </div>
    </>
  );
}

function RiskPage({ inputs, results, currency }) {
  const stressScenarios = [
    { label: 'Salary 20% lower', inputs: { ...inputs, salary: inputs.salary * 0.8, targetSalary: inputs.targetSalary * 0.8 } },
    { label: 'Expenses 15% higher', inputs: { ...inputs, expenses: Math.min(150000, inputs.expenses * 1.15) } },
    { label: 'Preparation 3 months longer', inputs: { ...inputs, prepMonths: Math.min(36, inputs.prepMonths + 3) } },
  ].map((scenario) => ({ ...scenario, result: calculateCareer(scenario.inputs) }));
  return (
    <>
      <PageIntro eyebrow="RISK ANALYSIS" title="See where the plan is vulnerable" description="Risk labels follow transparent scenario rules. A positive projected balance alone does not mean a scenario is safe." />
      <div className="risk-summary">
        <div><div className="eyebrow">CURRENT MODEL RATING</div><h2><RiskPill level={results.riskLevel} /></h2><p>{results.risks.length} risk condition{results.risks.length === 1 ? '' : 's'} identified from your current inputs.</p></div>
        <div className="risk-summary-stat"><span>Projected cash balance</span><strong className={results.endingBalance < 0 ? 'negative-value' : ''}>{formatMoney(results.endingBalance, currency)}</strong></div>
        <div className="risk-summary-stat"><span>Savings runway</span><strong>{results.runway === null ? 'Unlimited' : `${results.runway.toFixed(1)} months`}</strong></div>
      </div>
      <Panel title="Risk flags" subtitle="Each item includes the model rule and a possible mitigation">
        {results.risks.length === 0 ? <div className="empty-state"><Check size={20} /><strong>No configured risk thresholds were triggered.</strong><span>That does not guarantee a safe outcome; review the assumptions and stress tests below.</span></div> :
          <div className="risk-list">{results.risks.map((risk) => <article className="risk-card" key={risk.id}><div className="risk-card-top"><div><div className="risk-card-title"><ShieldAlert size={16} /><h3>{risk.title}</h3></div><p>{risk.explanation}</p></div><span className={`severity severity-${risk.severity.toLowerCase()}`}>{risk.severity}</span></div><div className="risk-metric"><strong>Relevant metric</strong><span>{risk.metric}</span></div><div className="risk-mitigation"><strong>Possible mitigation</strong><span>{risk.mitigation}</span></div></article>)}</div>}
      </Panel>
      <Panel title="Stress tests" subtitle="Illustrative adverse changes applied independently to this scenario">
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Stress test</th><th>Changed assumption</th><th>Ending balance</th><th>Change vs. baseline</th><th>Risk</th></tr></thead>
          <tbody>{stressScenarios.map((scenario) => <tr key={scenario.label}><td><strong>{scenario.label}</strong></td><td>{scenario.label.startsWith('Salary') ? `${formatMoney(scenario.inputs.salary, currency)} current salary` : scenario.label.startsWith('Expenses') ? `${formatMoney(scenario.inputs.expenses, currency)} monthly expenses` : `${scenario.inputs.prepMonths} preparation months`}</td><td className={scenario.result.endingBalance < 0 ? 'negative-value' : 'positive-value'}>{formatMoney(scenario.result.endingBalance, currency)}</td><td className={scenario.result.endingBalance >= results.endingBalance ? 'positive-value' : 'negative-value'}>{formatMoney(scenario.result.endingBalance - results.endingBalance, currency)}</td><td><RiskPill level={scenario.result.riskLevel} /></td></tr>)}</tbody>
        </table></div>
      </Panel>
    </>
  );
}

function HistoryPage({ items, search, setSearch, onRestore, currency }) {
  return (
    <>
      <PageIntro eyebrow="DECISION HISTORY" title="Revisit saved snapshots" description="Create a snapshot from Overview or the Simulator to keep a dated record of the result and risk rating." />
      <Panel title="Saved history" subtitle={`${items.length} snapshot${items.length === 1 ? '' : 's'} stored in this browser`} action={<label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search snapshots" aria-label="Search snapshots" /></label>}>
        {!items.length ? <div className="empty-state"><Clock3 size={20} /><strong>No saved snapshots yet</strong><span>Use “Save snapshot” on the simulator or a scenario row to add one.</span></div> :
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Decision name</th><th>Saved at</th><th>Projected outcome</th><th>Risk level</th><th>Actions</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{new Date(item.savedAt).toLocaleString()}</td><td>{formatMoney(item.endingBalance, currency)}</td><td><RiskPill level={item.riskLevel} /></td><td><button className="text-button" onClick={() => onRestore(item)}>Restore inputs <ArrowUpRight size={13} /></button></td></tr>)}</tbody>
          </table></div>}
      </Panel>
    </>
  );
}

function SettingsPage({ workspaceName, setWorkspaceName, onSaveName, currency, setCurrency, onJson, onCsv, onPrint }) {
  return (
    <>
      <PageIntro eyebrow="WORKSPACE SETTINGS" title="Make the workspace yours" description="Preferences and saved scenarios remain on this device. Currency changes affect formatting only; no exchange-rate conversion is performed." />
      <Panel title="General preferences" subtitle="Adjust labels and display preferences">
        <div className="settings-form">
          <label>Workspace name<input value={workspaceName} maxLength={50} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
          <button className="button button-secondary" onClick={onSaveName}><Check size={15} />Save workspace name</button>
          <label>Currency display<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="INR">Indian Rupee (INR)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option></select></label>
          <span className="settings-hint">Figures retain their entered values. Selecting a different currency does not convert them.</span>
        </div>
      </Panel>
      <Panel title="Reports & exports" subtitle="Download the current workspace data or print a report">
        <div className="export-options">
          <button className="export-option" onClick={onCsv}><span className="export-icon green"><FileSpreadsheet size={19} /></span><span><strong>Export scenarios as CSV</strong><small>Inputs and calculated metrics for each scenario</small></span><Download size={15} /></button>
          <button className="export-option" onClick={onJson}><span className="export-icon blue"><FileJson2 size={19} /></span><span><strong>Export workspace as JSON</strong><small>Inputs, metadata, history, and preferences</small></span><Download size={15} /></button>
          <button className="export-option" onClick={onPrint}><span className="export-icon amber"><Printer size={19} /></span><span><strong>Print or save as PDF</strong><small>Open the browser print dialog for a printable report</small></span><ArrowUpRight size={15} /></button>
        </div>
      </Panel>
      <Panel title="Model assumptions" subtitle="Transparent calculation notes">
        <ul className="assumption-list"><li>Living expenses are applied for every month of the projection.</li><li>Learning budget is applied during preparation months within the selected horizon.</li><li>Expected income after preparation weights current salary and target salary using the likelihood you enter; it is not a forecast or offer probability.</li><li>Annual salary growth is applied to modeled income once per 12 employed months.</li><li>No taxes, inflation, investment returns, debt, or unexpected costs are modeled.</li></ul>
      </Panel>
    </>
  );
}
