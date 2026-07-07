interface AutofillMatch {
  id: string;
  title: string;
  username: string;
  password: string;
  urlHint: string;
}

class AutofillOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private targetInput: HTMLInputElement | null = null;
  private rafId: number | null = null;
  private isDropdownOpen = false;

  private resizeObserver: ResizeObserver;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'zv-autofill-root';
    this.host.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 0; height: 0;
      overflow: visible; z-index: 2147483647;
      pointer-events: none;
    `;
    
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.resizeObserver = new ResizeObserver(() => this.queueUpdate());
    
    const style = document.createElement('style');
    style.textContent = `
      :host {
        --zv-cyan: #00F0FF;
        --zv-bg: rgba(10, 10, 15, 0.85);
        --zv-bg-hover: rgba(25, 25, 35, 0.95);
        --zv-border: rgba(0, 240, 255, 0.2);
        --zv-border-glow: rgba(0, 240, 255, 0.5);
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .wrapper {
        position: absolute;
        pointer-events: auto;
        display: none;
        flex-direction: column;
        align-items: flex-end;
        transition: opacity 0.2s ease;
      }

      .icon-btn {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: var(--zv-bg);
        border: 1px solid var(--zv-border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--zv-cyan);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      .icon-btn:hover {
        transform: scale(1.1);
        border-color: var(--zv-border-glow);
        box-shadow: 0 0 15px rgba(0,240,255,0.3);
      }
      
      .icon-btn.active {
        background: var(--zv-cyan);
        color: #000;
        box-shadow: 0 0 20px rgba(0,240,255,0.6);
      }

      .dropdown {
        position: absolute;
        top: 36px;
        right: 0;
        min-width: 260px;
        max-height: 320px;
        overflow-y: auto;
        background: linear-gradient(145deg, rgba(20,20,25,0.9) 0%, rgba(10,10,15,0.95) 100%);
        border: 1px solid var(--zv-border);
        border-radius: 12px;
        padding: 8px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1);
        backdrop-filter: blur(40px);
        -webkit-backdrop-filter: blur(40px);
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
      }
      
      .dropdown.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .dropdown::-webkit-scrollbar { width: 4px; }
      .dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

      .match-item {
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(255,255,255,0.02);
        border: 1px solid transparent;
        margin-bottom: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        color: #FFF;
      }
      
      .match-item:hover {
        background: var(--zv-bg-hover);
        border-color: var(--zv-border);
        transform: translateX(-4px);
      }
      
      .match-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
      .match-user { font-size: 11px; color: #8E8E93; letter-spacing: 0.5px; }
      
      .locked-state {
        padding: 20px;
        text-align: center;
        color: #FFF;
      }
      .locked-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--zv-cyan); }
      .unlock-btn {
        background: var(--zv-cyan);
        color: #000;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform 0.2s;
      }
      .unlock-btn:hover { transform: scale(1.05); }
      
      .empty-state {
        padding: 16px;
        text-align: center;
        color: rgba(255,255,255,0.5);
        font-size: 12px;
      }
    `;
    this.shadow.appendChild(style);
    
    this.container = document.createElement('div');
    this.container.className = 'wrapper';
    
    this.container.innerHTML = `
      <div class="icon-btn" id="trigger" title="Zero Vault Autofill">
        <svg viewBox="0 0 24 24" width="16" height="16" style="fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      <div class="dropdown" id="dropdown"></div>
    `;
    
    this.shadow.appendChild(this.container);
    
    const trigger = this.shadow.getElementById('trigger')!;
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });

    document.addEventListener('click', (e) => {
      // If click is outside the shadow DOM, close dropdown
      if (this.isDropdownOpen && !e.composedPath().includes(this.host)) {
        this.closeDropdown();
      }
    });

    // Handle scroll/resize to update position
    window.addEventListener('scroll', () => this.queueUpdate(), { passive: true, capture: true });
    window.addEventListener('resize', () => this.queueUpdate(), { passive: true });
  }

  mount() {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.appendChild(this.host);
    }
  }

  attachTo(input: HTMLInputElement) {
    if (this.targetInput === input) return;
    
    if (this.targetInput) {
      this.resizeObserver.unobserve(this.targetInput);
    }
    
    this.targetInput = input;
    this.resizeObserver.observe(this.targetInput);
    this.resizeObserver.observe(document.body);
    
    this.container.style.display = 'flex';
    this.closeDropdown();
    this.updatePosition();
  }

  hide() {
    if (this.targetInput) {
      this.resizeObserver.unobserve(this.targetInput);
    }
    this.targetInput = null;
    this.container.style.display = 'none';
    this.closeDropdown();
  }

  private queueUpdate() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updatePosition();
    });
  }

  private updatePosition() {
    if (!this.targetInput || this.container.style.display === 'none') return;
    
    const rect = this.targetInput.getBoundingClientRect();
    
    // Check if input is visible
    if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(this.targetInput).visibility === 'hidden') {
      this.container.style.display = 'none';
      return;
    } else {
      this.container.style.display = 'flex';
    }

    // Absolute positioning accounting for scroll
    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;
    
    // Position the icon inside the right edge of the input
    const iconSize = 28;
    const offsetRight = 8;
    
    this.container.style.top = `${top + (rect.height - iconSize) / 2}px`;
    this.container.style.left = `${left + rect.width - iconSize - offsetRight}px`;
  }

  private async toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
      return;
    }

    const trigger = this.shadow.getElementById('trigger')!;
    const dropdown = this.shadow.getElementById('dropdown')!;
    trigger.classList.add('active');
    dropdown.innerHTML = `<div class="empty-state">Decrypting memory...</div>`;
    dropdown.classList.add('open');
    this.isDropdownOpen = true;

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'AUTOFILL_QUERY',
        data: { url: window.location.href },
      });

      if (res?.locked) {
        this.renderLocked(dropdown);
        return;
      }

      const matches: AutofillMatch[] = res?.matches || [];
      if (matches.length === 0) {
        dropdown.innerHTML = `<div class="empty-state">No matching memories found.</div>`;
        return;
      }

      this.renderMatches(dropdown, matches);
    } catch (e) {
      dropdown.innerHTML = `<div class="empty-state">Secure connection failed.</div>`;
    }
  }

  private closeDropdown() {
    this.isDropdownOpen = false;
    this.shadow.getElementById('trigger')?.classList.remove('active');
    this.shadow.getElementById('dropdown')?.classList.remove('open');
  }

  private renderLocked(dropdown: HTMLElement) {
    dropdown.innerHTML = `
      <div class="locked-state">
        <div class="locked-title">VAULT LOCKED</div>
        <button class="unlock-btn" id="unlockBtn">AUTHENTICATE</button>
      </div>
    `;
    this.shadow.getElementById('unlockBtn')?.addEventListener('click', () => {
      // In MV3, we can't programmatically open the popup easily without activeTab/action,
      // but we can try to focus it or tell user to click the extension icon.
      dropdown.innerHTML = `<div class="empty-state">Click the Zero Vault icon in your browser toolbar to unlock.</div>`;
    });
  }

  private renderMatches(dropdown: HTMLElement, matches: AutofillMatch[]) {
    dropdown.innerHTML = '';
    matches.forEach(m => {
      const el = document.createElement('div');
      el.className = 'match-item';
      
      const title = document.createElement('div');
      title.className = 'match-title';
      title.textContent = m.title;
      
      const user = document.createElement('div');
      user.className = 'match-user';
      user.textContent = m.username;
      
      el.appendChild(title);
      el.appendChild(user);
      
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.fillCredentials(m);
        this.closeDropdown();
      });
      
      dropdown.appendChild(el);
    });
  }

  private fillCredentials(match: AutofillMatch) {
    if (!this.targetInput) return;
    
    // Find associated username field (usually the closest text/email input before the password)
    const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));
    const pwIndex = allInputs.indexOf(this.targetInput);
    
    if (pwIndex > 0 && match.username) {
      const userField = allInputs[pwIndex - 1];
      if (userField) this.nativeSetterBypass(userField, match.username);
    }
    
    this.nativeSetterBypass(this.targetInput, match.password);
  }

  private nativeSetterBypass(input: HTMLInputElement, value: string) {
    // Advanced hydration-safe injection
    input.focus();
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    
    // Flash effect using inline style since we can't inject global css cleanly without shadow DOM limits, 
    // but we CAN modify the input's inline style temporarily
    const originalShadow = input.style.boxShadow;
    const originalTransition = input.style.transition;
    input.style.transition = 'box-shadow 0.3s ease';
    input.style.boxShadow = '0 0 15px rgba(0,240,255,0.8)';
    setTimeout(() => {
      input.style.boxShadow = originalShadow;
      setTimeout(() => { input.style.transition = originalTransition; }, 300);
    }, 400);
  }
}

// Global Singleton
const overlay = new AutofillOverlay();

function initObserver() {
  overlay.mount();
  
  const findPasswordField = (): HTMLInputElement | null => {
    return document.querySelector<HTMLInputElement>('input[type="password"]');
  };

  const checkDOM = () => {
    const pw = findPasswordField();
    if (pw) {
      overlay.attachTo(pw);
    } else {
      overlay.hide();
    }
  };

  const observer = new MutationObserver(checkDOM);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'style', 'class']
  });

  // Initial check
  setTimeout(checkDOM, 500);
}

// Start only if we're in a browser environment
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
}

export {};
