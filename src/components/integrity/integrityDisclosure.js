export function createIntegrityDisclosureState(hasBlockingErrors) {
  return { expanded: hasBlockingErrors, hadBlockingErrors: hasBlockingErrors, manuallyCollapsed: false };
}

export function integrityDisclosureReducer(state, action) {
  if (action.type === "toggle") {
    const expanded = !state.expanded;
    return { ...state, expanded, manuallyCollapsed: state.hadBlockingErrors && !expanded };
  }
  if (action.type === "show") return { ...state, expanded: true, manuallyCollapsed: false };
  if (action.type !== "sync") return state;
  if (!action.hasBlockingErrors) return { ...state, hadBlockingErrors: false, manuallyCollapsed: false };
  if (!state.hadBlockingErrors) return { ...state, expanded: true, hadBlockingErrors: true, manuallyCollapsed: false };
  return { ...state, hadBlockingErrors: true };
}
