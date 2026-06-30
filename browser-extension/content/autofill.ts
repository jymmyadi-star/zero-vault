interface AutofillMatch {
  id: string;
  title: string;
  username: string;
  password: string;
  urlHint: string;
}

let injectedButton: HTMLDivElement | null = null;

function removeButton(): void {
  if (injectedButton) {
    injectedButton.remove();
    injectedButton = null;
  }
}

function findLoginFields(): HTMLInputElement[] {
  const inputs = document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
  const fields: HTMLInputElement[] = [];

  for (const input of inputs) {
    const type = (input.type || 'text').toLowerCase();
    if (type === 'password' || type === 'email' || type === 'text') {
      fields.push(input);
    }
  }

  return fields;
}

function findPasswordField(fields: HTMLInputElement[]): HTMLInputElement | null {
  for (const f of fields) {
    if (f.type === 'password') return f;
  }
  return null;
}

function injectButton(passwordField: HTMLInputElement): void {
  removeButton();

  const btn = document.createElement('div');
  btn.id = '_zv_autofill_btn';
  btn.innerHTML = '🔐';
  btn.title = 'Zero Vault Autofill';
  btn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,240,255,0.15);
    border: 1px solid rgba(0,240,255,0.3);
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    z-index: 2147483647;
    transition: all 0.15s;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(0,240,255,0.25)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(0,240,255,0.15)';
  });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await showAutofillPopup(btn, passwordField);
  });

  const parent = passwordField.parentElement;
  if (parent) {
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(btn);
    injectedButton = btn;
  }
}

async function showAutofillPopup(anchor: HTMLElement, passwordField: HTMLInputElement): Promise<void> {
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'AUTOFILL_QUERY',
      data: { url: window.location.href },
    });

    const matches: AutofillMatch[] = res?.matches || [];
    if (matches.length === 0) {
      showToast('No matching logins');
      return;
    }

    removeDropdown();

    const dropdown = document.createElement('div');
    dropdown.id = '_zv_dropdown';
    dropdown.style.cssText = `
      position: fixed;
      background: #0a0a0f;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 8px;
      z-index: 2147483647;
      min-width: 280px;
      max-height: 320px;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Courier New', Courier, monospace;
    `;

    const rect = anchor.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;

    dropdown.innerHTML = matches.map((m) => `
      <div class="_zv_item" data-id="${m.id}" style="
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; border-radius: 8px; cursor: pointer;
        color: #e0e0e0; font-size: 13px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      ">
        <div>
          <div style="font-weight: 600; font-size: 13px;">${escHtml(m.title)}</div>
          <div style="font-size: 10px; color: #888; margin-top: 2px;">${escHtml(m.username)}</div>
        </div>
      </div>
    `).join('');

    dropdown.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('._zv_item') as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.id!;
      const match = matches.find((m) => m.id === id);
      if (match) {
        fillCredentials(match, passwordField);
        removeDropdown();
      }
    });

    document.body.appendChild(dropdown);

    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && e.target !== anchor) {
        removeDropdown();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
  } catch (err) {
    console.error('[Zero Vault] Autofill query failed:', err);
  }
}

function fillCredentials(match: AutofillMatch, passwordField: HTMLInputElement): void {
  const fields = findLoginFields();
  const pwIndex = fields.indexOf(passwordField);

  // Fill username in the field before password field
  if (pwIndex > 0 && match.username) {
    const usernameField = fields[pwIndex - 1]!;
    setNativeValue(usernameField, match.username);
    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Fill password
  setNativeValue(passwordField, match.password);
  passwordField.dispatchEvent(new Event('input', { bubbles: true }));

  showToast('Filled!');
}

function setNativeValue(el: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
}

function removeDropdown(): void {
  const d = document.getElementById('_zv_dropdown');
  if (d) d.remove();
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  const existing = document.getElementById('_zv_toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.id = '_zv_toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #34C759; color: #000; padding: 10px 24px; border-radius: 20px;
    font-size: 13px; font-weight: 700; z-index: 2147483647;
    font-family: 'Courier New', Courier, monospace;
  `;
  document.body.appendChild(toast);

  toastTimer = setTimeout(() => {
    toast.remove();
    toastTimer = null;
  }, 2000);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Watch for password fields
const observer = new MutationObserver(() => {
  const fields = findLoginFields();
  const pw = findPasswordField(fields);
  if (pw && pw.offsetParent !== null) {
    injectButton(pw);
  } else {
    removeButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['type'],
});

// Initial scan
setTimeout(() => {
  const fields = findLoginFields();
  const pw = findPasswordField(fields);
  if (pw) injectButton(pw);
}, 500);

export {};
