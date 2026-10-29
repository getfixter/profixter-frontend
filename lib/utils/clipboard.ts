/**
 * Put text on the clipboard, and say whether it actually happened.
 *
 * navigator.clipboard is undefined on an insecure origin and can be refused by
 * permission policy, so the modern call is not a given - and a copy that
 * silently does nothing is worse than one that says it failed, because the
 * text looks copied until it is pasted. The textarea fallback covers the http
 * case an admin hits opening Admin on the office LAN by IP, and older iOS.
 *
 * Same behaviour as the helper inside BookingsTable, kept here so other Admin
 * screens can share it.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through and try the legacy path */
  }

  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}
