/**
 * Preserve focus + cursor position across a full innerHTML rebuild.
 * Views that re-render on every keystroke (because state changes trigger a
 * redraw) need this or typing into a field loses focus after one character.
 * Elements must carry a stable `data-field` attribute to be matched across renders.
 */
export function captureFocus(container) {
  const active = document.activeElement;
  if (!active || !container.contains(active) || !active.dataset || !active.dataset.field) return null;
  return {
    field: active.dataset.field,
    selStart: active.selectionStart,
    selEnd: active.selectionEnd,
  };
}

export function restoreFocus(container, saved) {
  if (!saved) return;
  const next = container.querySelector(`[data-field="${saved.field}"]`);
  if (!next) return;
  next.focus();
  if (saved.selStart != null && typeof next.setSelectionRange === 'function') {
    try {
      next.setSelectionRange(saved.selStart, saved.selEnd);
    } catch {
      /* ignore - some input types don't support selection ranges */
    }
  }
}
