import type {PollTable} from "./types"; const KEY="political-arena-state-v1";
export function saveTable(t:PollTable|null){if(!t)localStorage.removeItem(KEY);else localStorage.setItem(KEY,JSON.stringify(t))}
export function loadTable():PollTable|null{try{const x=localStorage.getItem(KEY);if(!x)return null;const v=JSON.parse(x) as PollTable;return v?.version===1&&Array.isArray(v.polls)&&Array.isArray(v.parties)?v:null}catch{return null}}
export const clearTable=()=>localStorage.removeItem(KEY);
