interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  urlHint: string;
  payload: Record<string, unknown>;
}

let items: VaultItem[] = [];
let vaultState: 'uninitialized' | 'locked' | 'unlocked' = 'locked';

const screenPairing = document.getElementById('screen-pairing')!;
const screenUnlock = document.getElementById('screen-unlock')!;
const screenVault = document.getElementById('screen-vault')!;
const statusEl = document.getElementById('status-text')!;
const statusDot = document.getElementById('status-dot')!;
const copiedEl = document.getElementById('toast')!;
const decryptionOverlay = document.getElementById('decryption-overlay')!;

async function send(msg: { type: string; data?: any }): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}

function showCopied(msg: string = 'COPIED'): void {
  copiedEl.textContent = msg;
  copiedEl.classList.add('show');
  setTimeout(() => copiedEl.classList.remove('show'), 2000);
}

function updateStatusUI() {
  if (vaultState === 'unlocked') {
    statusEl.textContent = 'SECURED';
    statusDot.className = 'status-dot secured';
  } else if (vaultState === 'uninitialized') {
    statusEl.textContent = 'AWAITING LINK';
    statusDot.className = 'status-dot locked';
  } else {
    statusEl.textContent = 'LOCKED';
    statusDot.className = 'status-dot locked';
  }
}

function switchScreen(activeScreen: HTMLElement) {
  [screenPairing, screenUnlock, screenVault].forEach(s => s.classList.remove('active'));
  activeScreen.classList.add('active');
}

function render(): void {
  updateStatusUI();

  if (vaultState === 'uninitialized') {
    switchScreen(screenPairing);
    const btnSetup = document.getElementById('btn-pair') as HTMLButtonElement;
    const errorMsg = document.getElementById('pair-error')!;
    
    btnSetup.onclick = async () => {
      const mnemonic = (document.getElementById('pairing-id-input') as HTMLInputElement).value.trim();
      const password = (document.getElementById('pairing-pin-input') as HTMLInputElement).value;
      
      if (!mnemonic || !password) {
        errorMsg.textContent = 'Seed and PIN are required.';
        errorMsg.style.display = 'block';
        return;
      }
      
      btnSetup.textContent = 'LINKING...';
      btnSetup.disabled = true;
      
      // Simulate cinematic delay
      await new Promise(r => setTimeout(r, 800));
      
      const res = await send({ type: 'SETUP_WITH_MNEMONIC', data: { mnemonic, password } });
      if (res.success) {
        vaultState = 'unlocked';
        await loadItems();
        render();
      } else {
        errorMsg.textContent = res.error ? `Link failed: ${res.error}` : 'Link failed. Invalid ID.';
        errorMsg.style.display = 'block';
        btnSetup.textContent = 'ESTABLISH LINK';
        btnSetup.disabled = false;
      }
    };
    return;
  }

  if (vaultState === 'locked') {
    switchScreen(screenUnlock);
    const btnUnlock = document.getElementById('btn-unlock') as HTMLButtonElement;
    const errorMsg = document.getElementById('unlock-error')!;
    const inputPwd = document.getElementById('pin-input') as HTMLInputElement;
    
    const handleUnlock = async () => {
      const password = inputPwd.value;
      if (!password) return;
      
      btnUnlock.disabled = true;
      errorMsg.style.display = 'none';
      
      // Show cinematic decryption overlay
      decryptionOverlay.classList.add('active');
      
      const res = await send({ type: 'UNLOCK_WITH_PASSWORD', data: { password } });
      
      // Minimum cinematic delay for visual effect
      await new Promise(r => setTimeout(r, 1200));
      
      decryptionOverlay.classList.remove('active');
      
      if (res.success) {
        vaultState = 'unlocked';
        inputPwd.value = '';
        await loadItems();
        render();
      } else {
        errorMsg.textContent = res.error ? `Verification failed: ${res.error}` : 'Cryptographic verification failed.';
        errorMsg.style.display = 'block';
        btnUnlock.disabled = false;
        inputPwd.value = '';
      }
    };
    
    btnUnlock.onclick = handleUnlock;
    inputPwd.onkeypress = (e) => { if (e.key === 'Enter') handleUnlock(); };
    setTimeout(() => inputPwd.focus(), 100);
    return;
  }

  // UNLOCKED STATE
  switchScreen(screenVault);
  renderItems(items);

  document.getElementById('search-input')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderItems(items.filter((i) => i.title.toLowerCase().includes(q) || i.username.toLowerCase().includes(q)));
  });
}

function renderItems(list: VaultItem[]): void {
  const el = document.getElementById('item-list');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
        Memory is empty.<br>No encrypted blocks found.
      </div>`;
    return;
  }

  el.innerHTML = list.map((item) => `
    <div class="item-card">
      <div class="item-icon-wrapper">
        <!-- Minimal initial logic, can expand later -->
        ${item.title.charAt(0).toUpperCase()}
      </div>
      <div class="item-content">
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-sub">${escHtml(item.username || item.urlHint || '')}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn copy-btn" data-id="${escHtml(item.id)}" data-field="username" title="Copy username">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </button>
        <button class="icon-btn copy-btn" data-id="${escHtml(item.id)}" data-field="password" title="Copy password">
          <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
        </button>
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
      
      if (!value) {
        showCopied('EMPTY');
        return;
      }
      
      try {
        await navigator.clipboard.writeText(value);
        showCopied('COPIED');
      } catch (err) {
        console.error('Clipboard write failed', err);
        showCopied('ERROR');
      }
    });
  });

  el.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = (card.querySelector('.copy-btn') as HTMLElement)?.dataset.id;
      if (id) {
        const item = list.find((i) => i.id === id);
        if (!item?.password) {
          showCopied('EMPTY');
          return;
        }
        try {
          await navigator.clipboard.writeText(item.password);
          showCopied('COPIED');
        } catch {
          showCopied('ERROR');
        }
      }
    });
  });
}

async function loadItems(): Promise<void> {
  const res = await send({ type: 'GET_ITEMS' });
  if (res.locked) { vaultState = 'locked'; return; }
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

(async () => {
  const res = await send({ type: 'GET_STATUS' });
  if (res.uninitialized) {
    vaultState = 'uninitialized';
  } else if (res.unlocked) {
    vaultState = 'unlocked';
    await loadItems();
    send({ type: 'SYNC_NOW' }).then(async () => {
      // Reload items after sync completes to show any new/deleted items
      await loadItems();
      render();
    }).catch(() => {});
  } else {
    vaultState = 'locked';
  }
  render();
})();

export {};
