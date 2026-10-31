export const DEFAULT_INPUTS = Object.freeze({
  salary: 67500,
  targetSalary: 95000,
  expenses: 15000,
  savings: 60000,
  prepMonths: 4,
  learningBudget: 2000,
  targetRoleProbability: 70,
  expectedSalaryGrowth: 8,
  horizon: 12,
});

const INPUT_MAXIMA = {
  salary: 250000,
  targetSalary: 300000,
  expenses: 150000,
  savings: 2000000,
  learningBudget: 50000,
  expectedSalaryGrowth: 50,
};

export const DEFAULT_SCENARIOS = Object.freeze([
  { id: 'conservative', name: 'Conservative', inputs: { ...DEFAULT_INPUTS, targetRoleProbability: 45, prepMonths: 6 } },
  { id: 'balanced', name: 'Balanced', inputs: { ...DEFAULT_INPUTS } },
  { id: 'ambitious', name: 'Ambitious', inputs: { ...DEFAULT_INPUTS, targetSalary: 120000, targetRoleProbability: 85, prepMonths: 6 } },
]);

const finiteNonNegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number.`);
  }
};

export function validateInputs(inputs) {
  const required = ['salary', 'targetSalary', 'expenses', 'savings', 'prepMonths', 'learningBudget', 'targetRoleProbability', 'expectedSalaryGrowth', 'horizon'];
  for (const key of required) {
    if (!Number.isFinite(inputs[key])) {
      throw new TypeError(`${key} must be a valid number.`);
    }
  }
  finiteNonNegative(inputs.salary, 'Current salary');
  finiteNonNegative(inputs.targetSalary, 'Target salary');
  finiteNonNegative(inputs.expenses, 'Monthly expenses');
  finiteNonNegative(inputs.savings, 'Current savings');
  finiteNonNegative(inputs.learningBudget, 'Learning budget');
  finiteNonNegative(inputs.expectedSalaryGrowth, 'Expected salary growth');
  for (const [key, maximum] of Object.entries(INPUT_MAXIMA)) {
    if (inputs[key] > maximum) {
      throw new RangeError(`${key} cannot exceed ${maximum}.`);
    }
  }
  if (inputs.prepMonths < 0 || inputs.prepMonths > 36) {
    throw new RangeError('Preparation time must be between 0 and 36 months.');
  }
  if (inputs.targetRoleProbability < 0 || inputs.targetRoleProbability > 100) {
    throw new RangeError('Target role likelihood must be between 0% and 100%.');
  }
  if (![12, 24, 36].includes(inputs.horizon)) {
    throw new RangeError('Projection period must be 12, 24, or 36 months.');
  }
}

export function calculateCareer(inputs) {
  validateInputs(inputs);
  const { salary, targetSalary, expenses, savings, prepMonths, learningBudget, targetRoleProbability, horizon } = inputs;
  const preparationMonths = Math.min(prepMonths, horizon);
  const earningMonths = Math.max(0, horizon - prepMonths);
  const targetProbability = targetRoleProbability / 100;
  const expectedMonthlySalary = prepMonths === 0
    ? salary
    : salary + (targetSalary - salary) * targetProbability;
  const totalExpenses = expenses * horizon;
  const totalLearningCost = learningBudget * preparationMonths;
  const runway = expenses === 0 ? null : savings / expenses;
  const monthlyCashFlow = expectedMonthlySalary - expenses;
  const timeline = [];
  let balance = savings;
  let totalIncome = 0;

  for (let month = 1; month <= horizon; month += 1) {
    const isPreparing = month <= prepMonths;
    const employedMonths = Math.max(0, month - prepMonths - 1);
    const growthFactor = (1 + inputs.expectedSalaryGrowth / 100) ** Math.floor(employedMonths / 12);
    const income = isPreparing ? 0 : expectedMonthlySalary * growthFactor;
    totalIncome += income;
    const learningCost = isPreparing ? learningBudget : 0;
    const net = income - expenses - learningCost;
    balance += net;
    timeline.push({
      month,
      label: `M${month}`,
      balance: Math.round(balance),
      income: Math.round(income),
      expenses: Math.round(expenses),
      learningCost: Math.round(learningCost),
      net: Math.round(net),
    });
  }

  const endingBalance = balance;
  const breakEvenMonth = calculateBreakEvenMonth(inputs, expectedMonthlySalary);
  const risks = buildRisks(inputs, { endingBalance, runway, expectedMonthlySalary, totalLearningCost });
  const riskLevel = risks.some((risk) => risk.severity === 'Critical')
    ? 'Critical'
    : risks.some((risk) => risk.severity === 'High')
      ? 'High'
      : risks.some((risk) => risk.severity === 'Moderate')
        ? 'Moderate'
        : 'Low';
  const recommendation = buildRecommendation(inputs, {
    endingBalance, runway, monthlyCashFlow, expectedMonthlySalary, riskLevel, risks,
  });

  return {
    horizon,
    earningMonths,
    expectedMonthlySalary,
    totalIncome,
    totalExpenses,
    totalLearningCost,
    endingBalance,
    runway,
    monthlyCashFlow,
    breakEvenMonth,
    timeline,
    risks,
    riskLevel,
    recommendation,
  };
}

function calculateBreakEvenMonth(inputs, expectedMonthlySalary) {
  if (inputs.prepMonths === 0 || inputs.prepMonths >= inputs.horizon || expectedMonthlySalary <= inputs.salary) return null;
  const opportunityCost = inputs.salary * inputs.prepMonths + inputs.learningBudget * Math.min(inputs.prepMonths, inputs.horizon);
  const monthlyAdvantage = expectedMonthlySalary - inputs.salary;
  if (monthlyAdvantage <= 0) return null;
  const month = inputs.prepMonths + Math.ceil(opportunityCost / monthlyAdvantage);
  return month <= inputs.horizon ? month : null;
}

function buildRisks(inputs, results) {
  const risks = [];
  if (results.runway !== null && inputs.prepMonths > results.runway) {
    risks.push({
      id: 'runway',
      title: 'Preparation outlasts current savings',
      severity: inputs.prepMonths > results.runway * 1.5 ? 'High' : 'Moderate',
      metric: `${results.runway.toFixed(1)} months of runway`,
      explanation: `Your planned ${inputs.prepMonths}-month preparation period is longer than your current savings runway.`,
      mitigation: 'Consider shortening preparation, reducing expenses, or arranging additional financial support.',
    });
  }
  if (results.endingBalance < 0) {
    risks.push({
      id: 'negative-balance',
      title: 'Projected cash balance is negative',
      severity: results.endingBalance < -inputs.expenses * 3 ? 'Critical' : 'High',
      metric: `Projected balance: ${Math.round(results.endingBalance)}`,
      explanation: `Under the selected assumptions, modeled outflows exceed savings and expected income by the end of ${inputs.horizon} months.`,
      mitigation: 'Stress-test lower expenses, a shorter preparation period, or a more conservative income estimate.',
    });
  }
  if (results.monthlyCashFlow < 0) {
    risks.push({
      id: 'cash-flow',
      title: 'Monthly expenses exceed modeled income',
      severity: 'High',
      metric: `Monthly cash flow: ${Math.round(results.monthlyCashFlow)}`,
      explanation: 'After employment begins, the modeled take-home income does not cover monthly living costs.',
      mitigation: 'Model a lower spending plan or adjust the salary assumption before relying on this scenario.',
    });
  }
  if (inputs.prepMonths > 0 && inputs.targetRoleProbability < 60) {
    risks.push({
      id: 'uncertain-income',
      title: 'Outcome depends on uncertain target-role income',
      severity: inputs.targetRoleProbability < 35 ? 'High' : 'Moderate',
      metric: `User-estimated likelihood: ${inputs.targetRoleProbability}%`,
      explanation: 'The projected salary after preparation is a weighted estimate, not guaranteed employment or a forecast.',
      mitigation: 'Compare this estimate with the current-salary fallback and revisit the likelihood as you get evidence.',
    });
  }
  if (results.runway !== null && results.runway < 3 && inputs.prepMonths > 0) {
    risks.push({
      id: 'limited-buffer',
      title: 'Limited savings buffer',
      severity: results.runway < 1 ? 'Critical' : 'Moderate',
      metric: `${results.runway.toFixed(1)} months of expenses`,
      explanation: 'A short runway leaves little room for delays or unexpected costs.',
      mitigation: 'Model a shorter preparation period and keep an emergency buffer in mind.',
    });
  }
  return risks;
}

function buildRecommendation(inputs, results) {
  if (results.endingBalance < 0) {
    return {
      title: 'Revisit the plan before committing',
      summary: `This scenario projects an ending cash balance of ${Math.round(results.endingBalance)} after ${inputs.horizon} months.`,
      tradeoff: 'A longer preparation period may improve the target salary assumption, but increases the time without employment income.',
      nextStep: 'Try a shorter preparation period or lower expenses, then compare the updated result.',
      evidence: 'Based on the selected inputs and a deterministic cash-flow calculation; not a prediction.',
    };
  }
  if (results.runway !== null && inputs.prepMonths > results.runway) {
    return {
      title: 'Your preparation plan exceeds the savings runway',
      summary: `Savings cover ${results.runway.toFixed(1)} months of expenses, compared with ${inputs.prepMonths} planned preparation months.`,
      tradeoff: `The model estimates ${Math.round(results.expectedMonthlySalary)} monthly income after preparation, but that estimate depends on your ${inputs.targetRoleProbability}% target-role likelihood.`,
      nextStep: 'Compare a shorter preparation plan and consider maintaining income while building skills.',
      evidence: 'Transparent rule: selected preparation period is longer than savings divided by monthly expenses.',
    };
  }
  return {
    title: 'This scenario fits within the modeled runway',
    summary: `The model estimates ${Math.round(results.endingBalance)} remaining after ${inputs.horizon} months, with ${results.runway === null ? 'unlimited' : `${results.runway.toFixed(1)} months of`} expense coverage in current savings.`,
    tradeoff: 'A higher target salary can improve the modeled outcome, while the target role likelihood and preparation time remain uncertain.',
    nextStep: 'Compare this scenario with starting employment sooner and review the risk flags before deciding.',
    evidence: 'Illustrative scenario math, not a financial or career prediction.',
  };
}

export function comparePreparationPeriods(inputs, periods = [0, 3, 6, 12]) {
  return periods.map((prepMonths) => {
    const scenarioInputs = { ...inputs, prepMonths };
    const result = calculateCareer(scenarioInputs);
    return {
      name: prepMonths === 0 ? 'Start now' : `Prepare ${prepMonths} mo`,
      prepMonths,
      expectedMonthlySalary: result.expectedMonthlySalary,
      totalIncome: Math.round(result.totalIncome),
      income: Math.round(result.totalIncome),
      endingBalance: Math.round(result.endingBalance),
      runway: result.runway,
      breakEvenMonth: result.breakEvenMonth,
      riskLevel: result.riskLevel,
      inputs: scenarioInputs,
    };
  });
}

export function analyzeSensitivity(inputs, variables = ['salary', 'expenses', 'savings', 'prepMonths']) {
  const baseline = calculateCareer(inputs).endingBalance;
  return variables.map((variable) => {
    const baseValue = inputs[variable];
    let lowValue;
    let highValue;
    if (variable === 'prepMonths') {
      lowValue = Math.max(0, baseValue - 3);
      highValue = Math.min(36, baseValue + 3);
    } else {
      lowValue = Math.max(0, baseValue * 0.8);
      const maximum = INPUT_MAXIMA[variable] ?? Number.POSITIVE_INFINITY;
      highValue = Math.min(maximum, baseValue * 1.2);
    }
    const lowResult = calculateCareer({ ...inputs, [variable]: lowValue }).endingBalance;
    const highResult = calculateCareer({ ...inputs, [variable]: highValue }).endingBalance;
    return {
      variable,
      baseline,
      lowValue,
      highValue,
      lowOutcome: lowResult,
      highOutcome: highResult,
      impact: Math.abs(highResult - lowResult),
    };
  }).sort((a, b) => b.impact - a.impact);
}
