export const initialToolsNavigation = Object.freeze({ activeTool: null });

export function toolsNavigationReducer(state, action) {
  if (action.type === "open" && ["importantInfo", "handover"].includes(action.tool)) return { activeTool: action.tool };
  if (action.type === "back") return { activeTool: null };
  return state;
}

export function canLeaveTools(dirty, confirmDiscard) {
  return !dirty || confirmDiscard("Discard unsaved tool changes?");
}
