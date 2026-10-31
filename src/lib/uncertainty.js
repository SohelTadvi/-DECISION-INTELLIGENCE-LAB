import { calculateCareer } from './careerModel.js';

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function triangularSample(min, max, random) {
  const mode = (min + max) / 2;
  const split = (mode - min) / (max - min);
  const sample = random();
  return sample < split
    ? min + Math.sqrt(sample * (max - min) * (mode - min))
    : max - Math.sqrt((1 - sample) * (max - min) * (max - mode));
}

function sampleRange(min, max, distribution, random) {
  if (min === max) return min;
  if (distribution === 'triangular') return triangularSample(min, max, random);
  if (distribution === 'normal') {
    const first = Math.max(Number.EPSILON, random());
    const second = random();
    const standardNormal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
    const mean = (min + max) / 2;
    const standardDeviation = (max - min) / 6;
    return Math.max(min, Math.min(max, mean + standardNormal * standardDeviation));
  }
  return min + random() * (max - min);
}

function percentile(sortedValues, fraction) {
  const index = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function simulateUncertainty(inputs, options = {}) {
  const {
    count = 1000,
    seed = 42,
    distribution = 'uniform',
    salaryRange = [inputs.salary * 0.8, inputs.salary * 1.2],
    expensesRange = [inputs.expenses * 0.9, inputs.expenses * 1.1],
    prepRange = [Math.max(0, inputs.prepMonths - 2), Math.min(36, inputs.prepMonths + 2)],
  } = options;
  if (![1000, 5000, 10000].includes(count)) {
    throw new RangeError('Choose 1,000, 5,000, or 10,000 simulation runs.');
  }
  if (!Number.isInteger(seed) || seed < 0) {
    throw new RangeError('The random seed must be a non-negative integer.');
  }
  if (!['uniform', 'triangular', 'normal'].includes(distribution)) {
    throw new RangeError('Choose a uniform, triangular, or normal distribution.');
  }
  const ranges = [salaryRange, expensesRange, prepRange];
  if (ranges.some(([min, max]) => !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min)) {
    throw new RangeError('Uncertainty ranges must contain finite, non-negative minimums and maximums.');
  }
  if (salaryRange[1] > 250000 || expensesRange[1] > 150000 || prepRange[1] > 36) {
    throw new RangeError('An uncertainty range exceeds the supported model limits.');
  }

  const random = createRandom(seed);
  const outcomes = [];
  for (let index = 0; index < count; index += 1) {
    const scenario = {
      ...inputs,
      salary: sampleRange(salaryRange[0], salaryRange[1], distribution, random),
      expenses: sampleRange(expensesRange[0], expensesRange[1], distribution, random),
      prepMonths: Math.round(sampleRange(prepRange[0], prepRange[1], distribution, random)),
    };
    outcomes.push(calculateCareer(scenario).endingBalance);
  }

  outcomes.sort((a, b) => a - b);
  const minimum = outcomes[0];
  const maximum = outcomes[outcomes.length - 1];
  const binCount = 20;
  const binSize = maximum === minimum ? 1 : (maximum - minimum) / binCount;
  const histogram = Array.from({ length: binCount }, (_, index) => {
    const start = minimum + index * binSize;
    const end = index === binCount - 1 ? maximum : start + binSize;
    return {
      range: `${Math.round(start)}–${Math.round(end)}`,
      midpoint: (start + end) / 2,
      count: 0,
    };
  });
  outcomes.forEach((value) => {
    const index = maximum === minimum ? 0 : Math.min(binCount - 1, Math.floor((value - minimum) / binSize));
    histogram[index].count += 1;
  });

  return {
    count,
    seed,
    distribution,
    median: percentile(outcomes, 0.5),
    percentile10: percentile(outcomes, 0.1),
    percentile90: percentile(outcomes, 0.9),
    negativeBalancePercent: outcomes.filter((value) => value < 0).length / count * 100,
    outcomes,
    histogram,
  };
}
