import { BLOCKLY_STORAGE_VERSION } from "./blocklyMissions.js";

export function blocklyStorageKey(session) {
  const identity = session?.userId || session?.user?.username || "guest";
  return `k12-blockly-lab:${identity}`;
}

export function readBlocklyProgress(session) {
  try {
    const value = JSON.parse(localStorage.getItem(blocklyStorageKey(session)) || "null");
    if (value?.version === BLOCKLY_STORAGE_VERSION) {
      return {
        version: BLOCKLY_STORAGE_VERSION,
        workspaces: value.workspaces || {},
        completed: value.completed || {},
      };
    }
  } catch {
    // Corrupt local progress is treated as a fresh run.
  }
  return { version: BLOCKLY_STORAGE_VERSION, workspaces: {}, completed: {} };
}
