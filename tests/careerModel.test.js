import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INPUTS,
  analyzeSensitivity,
  calculateCareer,
  comparePreparationPeriods,
  validateInputs,
} from '../src/lib/careerModel.js';
import { simulateUncertainty } from '../src/lib/uncertainty.js';
import { loadWorkspace, saveWorkspace } from '../src/lib/workspaceStorage.js';

test('immediate employment starts income in the first month', () => {
  const result = calculateCareer({ ...DEFAULT_INPUTS, prepMonths: 0 });
  assert.equal(result.timeline[0].income, DEFAULT_INPUTS.salary);
  assert.equal(result.earningMonths, 12);
});

test('preparation months have no employment income and include learning costs', () => {
  const result = calculateCareer({ ...DEFAULT_INPUTS, prepMonths: 3 });
  assert.equal(result.timeline[0].income, 0);
  assert.equal(result.timeline[0].learningCost, DEFAULT_INPUTS.learningBudget);
  assert.equal(result.earningMonths, 9);
});

test('ending balance includes weighted income, living expenses, and preparation costs', () => {
  const result = calculateCareer(DEFAULT_INPUTS);
  assert.equal(result.expectedMonthlySalary, 86750);
  assert.equal(result.totalIncome, 694000);
  assert.equal(result.totalExpenses, 180000);
  assert.equal(result.totalLearningCost, 8000);
  assert.equal(result.endingBalance, 566000);
});

test('zero expenses has unavailable runway instead of division by zero', () => {
  const result = calculateCareer({ ...DEFAULT_INPUTS, expenses: 0 });
  assert.equal(result.runway, null);
});

test('zero savings yields no financial runway', () => {
  const result = calculateCareer({ ...DEFAULT_INPUTS, savings: 0 });
  assert.equal(result.runway, 0);
});

test('negative ending balance is modeled and flagged', () => {
  const result = calculateCareer({
    ...DEFAULT_INPUTS,
    salary: 10000,
    targetSalary: 10000,
    savings: 0,
    expenses: 50000,
    prepMonths: 12,
    targetRoleProbability: 0,
  });
  assert.ok(result.endingBalance < 0);
  assert.ok(result.risks.some((risk) => risk.id === 'negative-balance'));
});

test('preparation equal to or beyond the horizon produces no income', () => {
  for (const prepMonths of [12, 18]) {
    const result = calculateCareer({ ...DEFAULT_INPUTS, prepMonths });
    assert.equal(result.totalIncome, 0);
    assert.equal(result.breakEvenMonth, null);
  }
});

test('break-even is unavailable when the modeled horizon cannot reach it', () => {
  const result = calculateCareer({ ...DEFAULT_INPUTS, prepMonths: 4, horizon: 12 });
  assert.equal(result.breakEvenMonth, null);
});

test('salary below expenses produces negative post-employment cash flow', () => {
  const result = calculateCareer({
    ...DEFAULT_INPUTS,
    salary: 10000,
    targetSalary: 10000,
    expenses: 20000,
    prepMonths: 0,
  });
  assert.equal(result.monthlyCashFlow, -10000);
});

test('invalid inputs are rejected with an actionable error', () => {
  assert.throws(() => validateInputs({ ...DEFAULT_INPUTS, savings: -1 }), /non-negative/);
  assert.throws(() => validateInputs({ ...DEFAULT_INPUTS, horizon: 13 }), /12, 24, or 36/);
  assert.throws(() => validateInputs({ ...DEFAULT_INPUTS, salary: Number.NaN }), /valid number/);
  assert.throws(() => validateInputs({ ...DEFAULT_INPUTS, targetSalary: 300001 }), /cannot exceed/);
});

test('scenario comparison recalculates each preparation period', () => {
  const scenarios = comparePreparationPeriods(DEFAULT_INPUTS);
  assert.equal(scenarios.length, 4);
  assert.equal(scenarios[0].prepMonths, 0);
  assert.equal(scenarios[0].income, DEFAULT_INPUTS.salary * 12);
});

test('sensitivity analysis ranks variables using calculated outcome impact', () => {
  const sensitivities = analyzeSensitivity(DEFAULT_INPUTS);
  assert.ok(sensitivities.length >= 3);
  assert.ok(sensitivities.every((item) => item.impact >= 0));
  assert.ok(sensitivities[0].impact >= sensitivities.at(-1).impact);
});

test('seeded uncertainty simulations are reproducible and compute percentiles', () => {
  const options = { count: 1000, seed: 1337, salaryRange: [50000, 80000], expensesRange: [12000, 20000], prepRange: [0, 8] };
  const first = simulateUncertainty(DEFAULT_INPUTS, options);
  const second = simulateUncertainty(DEFAULT_INPUTS, options);
  assert.equal(first.median, second.median);
  assert.equal(first.percentile10, second.percentile10);
  assert.ok(first.percentile10 <= first.median);
  assert.ok(first.median <= first.percentile90);
  assert.equal(first.histogram.reduce((sum, bin) => sum + bin.count, 0), 1000);
});

test('uncertainty simulations reject invalid range and run count', () => {
  assert.throws(() => simulateUncertainty(DEFAULT_INPUTS, { count: 200 }), /Choose 1,000/);
  assert.throws(() => simulateUncertainty(DEFAULT_INPUTS, { salaryRange: [50000, -1] }), /non-negative/);
});

test('uncertainty simulator supports reproducible triangular and normal sampling', () => {
  for (const distribution of ['triangular', 'normal']) {
    const result = simulateUncertainty(DEFAULT_INPUTS, {
      count: 1000,
      seed: 12,
      distribution,
      salaryRange: [50000, 80000],
      expensesRange: [12000, 20000],
      prepRange: [1, 8],
    });
    assert.equal(result.distribution, distribution);
    assert.ok(result.percentile10 <= result.percentile90);
  }
});

test('workspace persistence restores scenarios, history, and preferences', () => {
  const originalWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  try {
    const scenarios = [{ id: 'scenario-1', name: 'Balanced', inputs: DEFAULT_INPUTS }];
    const history = [{ id: 'snapshot-1', name: 'Balanced', endingBalance: 10 }];
    const preferences = { currency: 'INR', goal: { metric: 'endingBalance', target: 200000 } };
    saveWorkspace(scenarios, history, preferences);
    const restored = loadWorkspace();
    assert.deepEqual(restored.scenarios, scenarios);
    assert.deepEqual(restored.history, history);
    assert.deepEqual(restored.preferences, preferences);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
