interface FieldLike {
  tagName?: string;
  type?: string;
  value?: unknown;
}

const TEXT_INPUT_TYPES = new Set(['', 'text', 'email', 'password', 'search', 'url', 'tel']);

/** True for a textarea or a text-style input (not sliders, checkboxes or buttons). */
export function isTextField(field: FieldLike): boolean {
  const tag = field.tagName?.toUpperCase();
  if (tag === 'TEXTAREA') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has((field.type ?? '').toLowerCase());
}

/**
 * Whether an Escape press should close the Settings box.
 * If any text field in the box has something typed, Escape is ignored,
 * so a half-written feedback note or sign-in form is not thrown away.
 */
export function shouldCloseOnEscape(key: string, fields: Iterable<FieldLike>): boolean {
  if (key !== 'Escape') return false;
  for (const field of fields) {
    if (isTextField(field) && typeof field.value === 'string' && field.value !== '') return false;
  }
  return true;
}
