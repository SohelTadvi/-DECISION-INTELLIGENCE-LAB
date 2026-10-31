# Decision Intelligence Lab

A browser-based decision workspace for modeling career scenarios. Edit assumptions and compare how preparation time, salary, spending, savings, and learning costs affect projected cash flow. All figures are illustrative calculations from the inputs you provide—not financial, employment, or salary predictions.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Vite prints a local URL when the development server is ready.

## Validate

```bash
npm test
npm run lint
npm run build
```

## Current features

- Career decision model with editable slider and exact numeric inputs.
- 12-, 24-, and 36-month projection horizons.
- Projected cash balance, income, expenses, learning costs, runway, and a transparent break-even estimate.
- Preparation-duration comparisons and editable saved scenario copies.
- Scenario history snapshots stored locally in the browser.
- Scenario comparison, sensitivity analysis, risk rules, and independent adverse stress tests.
- What-if analysis with simultaneous adjustments and apply-to-scenario support.
- Seeded uncertainty simulations with uniform, triangular, and truncated normal sampling.
- Goal tracking and a rule-based Decision Copilot grounded in the active model.
- CSV and JSON downloads, plus a print-friendly report.
- Dark and light themes, responsive navigation, and INR/USD/EUR number formatting.

## Model notes

- Living expenses continue during each modeled month. The learning budget is counted during preparation months within the selected horizon.
- Before preparation, the model uses current salary. After preparation, expected salary is a weighted average of current and target salary using the user-entered target-role likelihood. This is a scenario assumption, not a probability forecast.
- Annual salary growth is applied once per 12 employed months.
- Currency selection changes the displayed currency format only; it does not convert values.
- Taxes, inflation, debt, investment returns, and unexpected expenses are not included.
- Saved scenarios and history use this browser's local storage. Clearing browser data removes them; this app does not sync data to a server.
- Uncertainty Lab percentiles and negative-balance share describe only the specified sample ranges and distribution. They are not calibrated forecasts or the probability of receiving an offer.
- Decision Copilot is local and rule-based; an external AI integration is not configured.

## Project layout

- `src/lib/careerModel.js` — validated scenario calculations, comparisons, risks, and sensitivity analysis.
- `src/lib/workspaceStorage.js` — local scenario and history persistence.
- `src/App.jsx` — interactive dashboard and scenario workspace.
- `src/App.css` — responsive design system and print styles.
- `tests/careerModel.test.js` — calculation and validation tests using Node's built-in test runner.
