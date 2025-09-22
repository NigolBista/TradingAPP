type Listener = () => void;

export type OverlayState = {
  message: string | null;
  waiting: boolean;
};

let state: OverlayState = { message: null, waiting: false };
const messageListeners: Array<(s: OverlayState) => void> = [];
const cancelListeners: Listener[] = [];
const continueListeners: Listener[] = [];
const openChatListeners: Listener[] = [];

function notify() {
  messageListeners.forEach((l) => l({ ...state }));
}

export function showOverlayMessage(message: string, waitForContinue?: boolean) {
  state.message = message;
  state.waiting = !!waitForContinue;
  notify();
}

export function setOverlayWaiting(waiting: boolean) {
  state.waiting = waiting;
  notify();
}

export function hideOverlayMessage() {
  state.message = null;
  state.waiting = false;
  notify();
}

export function onOverlayMessage(listener: (s: OverlayState) => void) {
  messageListeners.push(listener);
}

export function offOverlayMessage(listener: (s: OverlayState) => void) {
  const idx = messageListeners.indexOf(listener);
  if (idx >= 0) messageListeners.splice(idx, 1);
}

export function requestCancelOverlayFlow() {
  cancelListeners.forEach((l) => l());
}

export function onOverlayCancel(listener: Listener) {
  cancelListeners.push(listener);
}

export function offOverlayCancel(listener: Listener) {
  const idx = cancelListeners.indexOf(listener);
  if (idx >= 0) cancelListeners.splice(idx, 1);
}

export function requestContinueOverlayFlow() {
  // resolve all listeners and clear waiting state
  continueListeners.forEach((l) => l());
  setOverlayWaiting(false);
}

export function onOverlayContinue(listener: Listener) {
  continueListeners.push(listener);
}

export function offOverlayContinue(listener: Listener) {
  const idx = continueListeners.indexOf(listener);
  if (idx >= 0) continueListeners.splice(idx, 1);
}

export function requestOpenChat() {
  openChatListeners.forEach((l) => l());
}

export function onOverlayOpenChat(listener: Listener) {
  openChatListeners.push(listener);
}

export function offOverlayOpenChat(listener: Listener) {
  const idx = openChatListeners.indexOf(listener);
  if (idx >= 0) openChatListeners.splice(idx, 1);
}
