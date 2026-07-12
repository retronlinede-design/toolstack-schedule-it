export function createIntegrityDisclosureState(hasBlockingErrors) {
  void hasBlockingErrors;
  return { expanded: false };
}

export function integrityDisclosureReducer(state, action) {
  if (action.type === "toggle") {
    const expanded = !state.expanded;
    return { ...state, expanded };
  }
  if (action.type === "show") return { ...state, expanded: true };
  return state;
}
