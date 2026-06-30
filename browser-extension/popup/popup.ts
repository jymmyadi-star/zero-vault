interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  urlHint: string;
  payload: Record<string, unknown>;
}

let items: VaultItem[] = [];
let unlocked = false;
let auth = false;

const content = document.getElementById('content')!;
const statusEl = document.getElementById('status')!;
const copiedEl = document.getElementById('copied')!;

async function send(msg: { type: string; data?: any }): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}

function showCopied(): void {
  copiedEl.classList.add('show');
  setTimeout(() => copiedEl.classList.remove('show'), 1500);
}

function render(): void {
  if (!auth) {
    content.innerHTML = `
      <div class="empty" style="padding: 40px 0">
        <p style="margin-bottom: 16px; color: #aaa; font-size: 13px;">Connect to your Zero Vault</p>
        <button class="btn btn-primary" id="btn-auth">SIGN IN ANONYMOUSLY</button>
        <p style="margin-top: 12px; font-size: 10px; color: #666;">Sync encrypted data from your vault</p>
      </div>`;
    document.getElementById('btn-auth')?.addEventListener('click', async () => {
      const res = await send({ type: 'ANON_SIGN_IN' });
      if (res.success) { auth = true; render(); }
      else { content.innerHTML = `<div class="error">${escHtml(res.error || 'Auth failed')}</div>`; }
    });
    return;
  }

  if (!unlocked) {
    content.innerHTML = `
      <div style="padding: 10px 0">
        <p style="margin-bottom: 8px; font-size: 12px; color: #FF3B30;">Vault locked — enter your 24-word recovery phrase:</p>
        <textarea class="mnemonic-input" id="mnemonic" placeholder="word1 word2 word3 ... word24" autofocus></textarea>
        <button class="btn btn-primary" id="btn-unlock">UNLOCK VAULT</button>
        <p style="margin-top: 12px; font-size: 10px; color: #666;">The vault auto-locks after ${15} minutes of inactivity.</p>
      </div>`;
    document.getElementById('btn-unlock')?.addEventListener('click', async () => {
      const mnemonic = (document.getElementById('mnemonic') as HTMLTextAreaElement).value.trim();
      if (!mnemonic) { alert('Please enter your recovery phrase.'); return; }
      const res = await send({ type: 'UNLOCK_WITH_MNEMONIC', data: { mnemonic } });
      if (res.success) { unlocked = true; statusEl.textContent = 'UNLOCKED'; statusEl.className = 'status unlocked'; await loadItems(); render(); }
      else { alert('Invalid recovery phrase. Check your 24 words and try again.'); }
    });
    return;
  }

  content.innerHTML = `
    <input class="search" id="search" placeholder="Search vault..." autofocus>
    <div id="itemList" class="item-list"></div>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <button class="btn" id="btn-sync" style="flex:1">SYNC</button>
      <button class="btn" id="btn-lock" style="flex:1; color: #FF3B30;">LOCK</button>
    </div>`;

  renderItems(items);

  document.getElementById('search')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderItems(items.filter((i) => i.title.toLowerCase().includes(q) || i.username.toLowerCase().includes(q)));
  });

  document.getElementById('btn-sync')?.addEventListener('click', async () => {
    await send({ type: 'SYNC_NOW' });
    await loadItems();
    render();
  });

  document.getElementById('btn-lock')?.addEventListener('click', async () => {
    await send({ type: 'LOCK' });
    unlocked = false;
    statusEl.textContent = 'LOCKED';
    statusEl.className = 'status locked';
    items = [];
    render();
  });
}

function renderItems(list: VaultItem[]): void {
  const el = document.getElementById('itemList');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty">No items found. Sync to fetch your vault.</div>';
    return;
  }

  el.innerHTML = list.map((item) => `
    <div class="item" data-id="${escHtml(item.id)}">
      <div>
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-sub">${escHtml(item.username || item.urlHint || '')}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn copy-btn" data-id="${escHtml(item.id)}" data-field="username" title="Copy username">👤</button>
        <button class="icon-btn copy-btn" data-id="${escHtml(item.id)}" data-field="password" title="Copy password">📋</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const el = btn as HTMLElement;
      const id = el.dataset.id!;
      const field = el.dataset.field!;
      const item = list.find((i) => i.id === id);
      const value = field === 'username' ? item?.username : item?.password;
      if (value) {
        await navigator.clipboard.writeText(value);
        showCopied();
      }
    });
  });
}

async function loadItems(): Promise<void> {
  const res = await send({ type: 'GET_ITEMS' });
  if (res.locked) { unlocked = false; return; }
  items = res.items.map((i: any) => ({
    id: i.id,
    title: i.title,
    username: (i.payload as any)?.username || '',
    password: (i.payload as any)?.password || '',
    urlHint: i.urlHint || '',
    payload: i.payload,
  }));
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const AUTO_LOCK_MINUTES = 15;

(async () => {
  const res = await send({ type: 'GET_STATUS' });
  auth = res.authenticated;
  unlocked = res.unlocked;
  if (unlocked) {
    statusEl.textContent = 'UNLOCKED';
    statusEl.className = 'status unlocked';
    await loadItems();
  }
  render();
})();

export {};
