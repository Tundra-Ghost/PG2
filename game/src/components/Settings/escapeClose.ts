/**
 * Whether an Escape press should close the Settings box.
 * Escape inside a text field with something typed is left alone,
 * so a half-written feedback note or sign-in form is not thrown away.
 */
export function shouldCloseOnEscape(key: string, target: { tagName?: string; value?: unknown } | null): boolean {
  if (key !== 'Escape') return false;
  const tag = target?.tagName?.toUpperCase();
  if ((tag === 'INPUT' || tag === 'TEXTAREA') && typeof target?.value === 'string' && target.value !== '') {
    return false;
  }
  return true;
}
