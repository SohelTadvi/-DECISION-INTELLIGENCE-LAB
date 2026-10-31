const STORAGE_KEY = 'decision-intelligence-lab.workspace.v1';

export function loadWorkspace() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { scenarios: null, history: [], preferences: {}, error: null };
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.scenarios)) {
      throw new TypeError('Saved workspace does not contain a valid scenario list.');
    }
    return {
      scenarios: parsed.scenarios,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      preferences: parsed.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {},
      error: null,
    };
  } catch (error) {
    return {
      scenarios: null,
      history: [],
      preferences: {},
      error: `Saved scenarios could not be loaded: ${error.message}`,
    };
  }
}

export function saveWorkspace(scenarios, history, preferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    scenarios,
    history,
    preferences,
  }));
}
