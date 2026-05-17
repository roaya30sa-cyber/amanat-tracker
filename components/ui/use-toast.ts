'use client';
// Adapted from shadcn/ui toast hook
import * as React from 'react';
import type { ToastProps, ToastActionElement } from './toast';

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 3500;

type ToasterToast = ToastProps & { id: string; title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement };

let count = 0;
function genId() { return (++count).toString(); }

type ActionType =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> & { id: string } }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string };

interface State { toasts: ToasterToast[]; }

const listeners: ((s: State) => void)[] = [];
let memoryState: State = { toasts: [] };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
}

function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case 'ADD_TOAST':    return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'UPDATE_TOAST': return { ...state, toasts: state.toasts.map(t => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) };
    case 'DISMISS_TOAST': {
      const { toastId } = action;
      if (toastId) addToRemoveQueue(toastId);
      else state.toasts.forEach(t => addToRemoveQueue(t.id));
      return { ...state, toasts: state.toasts.map(t => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)) };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.toastId) };
  }
}

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action);
  listeners.forEach(l => l(memoryState));
}

type Toast = Omit<ToasterToast, 'id'>;
function toast({ ...props }: Toast) {
  const id = genId();
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id, open: true, onOpenChange: o => { if (!o) dispatch({ type: 'DISMISS_TOAST', toastId: id }); } } });
  return { id, dismiss: () => dispatch({ type: 'DISMISS_TOAST', toastId: id }) };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1); };
  }, [state]);
  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }) };
}

export { useToast, toast };
