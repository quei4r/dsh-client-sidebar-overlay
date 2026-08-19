/* Sidebar overlay plugin (browser half).
 *
 * - Whale toggle in the session header utilities: pops the sidebar as an
 *   overlay panel that never consumes layout width; opening auto-expands a
 *   collapsed rail first.
 * - Side-switch row inside the sidebar foot: overlay slides from right or
 *   left; borders/shadow follow.
 * - v0.1.7: the column slides with `left` instead of transform. A transformed
 *   ancestor becomes the containing block for position:fixed descendants, so
 *   the product's full-screen modals (settings overlay inset:0, Cordis
 *   panel) were trapped in the 280px column — clicking 设置 appeared to do
 *   nothing. left keeps the slide while fixed elements stay viewport-anchored;
 *   the old fixedAdapter (a transform-workaround) is retired with it.
 *
 * - popupClamp: role-based (menu/listbox/tooltip/dialog/alertdialog) viewport
 *   clamping via the independent CSS `translate` property.
 * - selectShim: native <select> popups are OS chrome and cannot be clamped;
 *   inside the sidebar they are replaced with an in-page popup that writes
 *   value + change back to the original select.
 *
 * v0.1.1: the DOM surgery moved from the session-scoped WhaleToggle mount to
 * apply() — the header button unmounts/remounts on every session switch, and
 * per-mount attach/detach made the sidebar flash back into normal layout.
 * Attachment now lives for the page lifetime and only re-attaches if the
 * AppFrame element itself is replaced.
 *
 * v0.1.2: the header whale sits in a session-scoped slot, so the hero /
 * new-session main screen (no session header) hid the sidebar with no way
 * back in. whaleFloat now mounts a fixed-position fallback whale whenever the
 * header toggle is absent, keeping the overlay reachable from every screen
 * (mount debounced 150ms so session-switch remounts don't flash it).
 *
 * v0.1.4: the v0.1.3 auto-collapse (close on session-screen entry) tested
 * the STEADY state of the header whale instead of its appearance, so every
 * body mutation while open — the streaming conversation's DOM churn — snapped
 * a freshly opened overlay shut the same tick; the whale toggle read as dead.
 * The close now fires only on the rising edge of store.whaleBtn connectivity.
 *
 * v0.1.5: applyCol() on store changes was wired ONLY through the WhaleToggle
 * React component's subscription — but the hero / new-session screen has no
 * session header, so that component is unmounted there. Clicking the brand
 * wordmark (new session) with the overlay open landed on the hero, and the
 * first outside click flipped store.open to false with NOBODY re-applying the
 * column geometry: the column stayed on screen while the state said closed.
 * Blank clicks then no-opped (!store.open) and the whale toggled an already
 * open column — everything read as dead. applyCol now rides a page-lifetime
 * store subscription (attachFrame), and the auto-collapse edge tracks the
 * whale NODE identity so an atomic same-commit remount (session switch:
 * ref(null) then ref(node) before the observer runs) still counts as fresh.
 */
window.__ModuleLoader__.load({
  id: 'dsh-client-sidebar-overlay',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require('react');

    var CSS = [
      '.cordis-sflip-marker{display:none}',
      '.cordis-sflip-whale{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer;padding:0}',
      '.cordis-sflip-whale:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.cordis-sflip-whale[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.cordis-sflip-float{position:fixed;top:10px;right:12px;z-index:60;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));border-radius:8px;background:var(--dsw-alias-bg-base,#1f2023);color:inherit;cursor:pointer;padding:0;box-shadow:0 2px 12px rgba(0,0,0,.3)}',
      '.cordis-sflip-float:hover,.cordis-sflip-float[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.cordis-sflip-float.is-open{display:none}',
      '.cordis-sflip-frame > [data-shell-overlay] ~ *{display:none!important}',
      '.cordis-sflip-row{display:flex;align-items:center;justify-content:center;padding:2px 4px}',
      '.cordis-sflip-row[data-wide="true"]{justify-content:flex-start;padding:0;margin:4px 0 0}',
      '.cordis-sflip-sidebtn{display:flex;align-items:center;justify-content:center;gap:6px;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;line-height:1;font:inherit}',
      '.cordis-sflip-row[data-wide="true"] .cordis-sflip-sidebtn{width:100%;height:49px;justify-content:flex-start;gap:8px;padding:0 8px 0 6px;border-radius:12px;font-size:14px;line-height:22px}',
      '.cordis-sflip-sidebtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.cordis-sflip-sidebtn svg{flex:none}',
      '.cordis-sflip-selectpop{position:fixed;z-index:100;background:var(--dsw-alias-bg-base,#1f2023);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));border-radius:8px;padding:4px;box-shadow:0 8px 28px rgba(0,0,0,.35);max-height:40vh;overflow:auto;display:flex;flex-direction:column;gap:2px}',
      '.cordis-sflip-selectitem{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;line-height:1.6;padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap}',
      '.cordis-sflip-selectitem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.cordis-sflip-selectitem.is-current{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.cordis-sflip-selectitem:disabled{opacity:.45;cursor:default}',
    ].join('\n');

    var FISH_PATH = 'M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z';

    var sideIcon = function (dir) {
      return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M6 2.5H3.4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6"/>'
        + '<path d="M10 2.5h2.6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10"/>'
        + (dir === 'left'
          ? '<path d="M10.5 8h-5m0 0 2-2m-2 2 2 2"/>'
          : '<path d="M5.5 8h5m0 0-2-2m2 2-2 2"/>')
        + '</svg>';
    };

    var store = {
      open: false,
      side: 'right',
      active: false,
      whaleBtn: null,
      listeners: [],
      emit: function () { for (var i = 0; i < this.listeners.length; i++) this.listeners[i]() },
      subscribe: function (fn) {
        var self = this;
        this.listeners.push(fn);
        return function () {
          var i = self.listeners.indexOf(fn);
          if (i >= 0) self.listeners.splice(i, 1);
        };
      },
      set: function (key, value) {
        if (this[key] === value) return;
        this[key] = value;
        this.emit();
      },
    };

    var ctrl = {
      frame: null,
      col: null,
      content: null,
      S: 280,
      lastCols: '',
      saved: null,
      mo: null,
      onResize: null,
      onDocDown: null,
      unsubStore: null,
    };

    var layoutSvc = null;

    function splitTracks(v) {
      var out = [];
      var depth = 0;
      var cur = '';
      for (var i = 0; i < v.length; i++) {
        var ch = v[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ' ' && depth === 0) {
          if (cur) { out.push(cur); cur = ''; }
          continue;
        }
        cur += ch;
      }
      if (cur) out.push(cur);
      return out;
    }

    function applyCol() {
      var frame = ctrl.frame;
      var col = ctrl.col;
      if (!frame || !col) return;
      var frameW = frame.clientWidth;
      var S = ctrl.S || 280;
      var right = store.side !== 'left';
      col.style.width = S + 'px';
      var x;
      if (store.open) x = right ? Math.max(0, frameW - S) : 0;
      else x = right ? frameW + 4 : -(S + 4);
      // Slide with `left`, NOT `transform`: a transformed ancestor becomes the
      // containing block for position:fixed descendants, so the product's
      // full-screen modals (settings overlay, Cordis panel …) get trapped in
      // the 280px column and read as "clicking does nothing". position:relative
      // + left keeps the visual slide without hijacking fixed positioning.
      col.style.left = x + 'px';
      col.style.visibility = store.open ? 'visible' : 'hidden';
      col.style.pointerEvents = store.open ? 'auto' : 'none';
      col.style.transition = store.open
        ? 'left .22s ease, visibility 0s linear 0s'
        : 'left .22s ease, visibility 0s linear .22s';
      col.style.borderLeft = right ? '1px solid var(--dsw-alias-border-l1)' : 'none';
      col.style.borderRight = right ? 'none' : '1px solid var(--dsw-alias-border-l1)';
      if (ctrl.content) {
        ctrl.content.style.boxShadow = store.open
          ? (right ? '-16px 0 40px rgba(0,0,0,.28)' : '16px 0 40px rgba(0,0,0,.28)')
          : 'none';
      }
    }

    function syncCols() {
      var frame = ctrl.frame;
      if (!frame) return;
      var v = frame.style.gridTemplateColumns;
      if (!v) return;
      var tracks = splitTracks(v);
      if (tracks.length < 2) return;
      if (tracks[0] !== '0px') {
        ctrl.S = parseFloat(tracks[0]) || ctrl.S;
        ctrl.lastCols = v;
        var next = tracks.slice();
        next[0] = '0px';
        frame.style.gridTemplateColumns = next.join(' ');
      }
      applyCol();
    }

    var popupClamp = {
      doc: null,
      win: null,
      observer: null,
      corr: null,
      corrected: null,
      ROLE_SELECTOR: '[role="menu"],[role="listbox"],[role="tooltip"],[role="dialog"],[role="alertdialog"]',
      clamp: function (el) {
        if (!this.corr) return; // stop()ped with rAF/timeout callbacks pending
        if (!el || !el.isConnected) return;
        var rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return;
        var vw = this.win.innerWidth;
        if (rect.width > vw * 0.95) return;
        var prev = this.corr.get(el) || 0;
        var baseLeft = rect.left - prev;
        var baseRight = rect.right - prev;
        var dx = 0;
        if (baseRight > vw - 2) dx = Math.ceil(vw - 2 - baseRight);
        else if (baseLeft < 2) dx = Math.ceil(2 - baseLeft);
        if (dx === prev) return;
        if (dx !== 0) {
          var cs = this.win.getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.opacity === '0') return;
        }
        this.corr.set(el, dx);
        if (dx === 0) {
          el.style.translate = '';
          this.corrected.delete(el);
        } else {
          el.style.translate = dx + 'px 0';
          this.corrected.add(el);
        }
      },
      clampSoon: function (el) {
        var self = this;
        this.win.requestAnimationFrame(function () { self.clamp(el); });
        this.win.setTimeout(function () { self.clamp(el); }, 140);
      },
      consider: function (node) {
        if (!node || node.nodeType !== 1) return;
        // Opportunistically prune corrections for removed popups so the Set
        // cannot grow unbounded over the page lifetime.
        if (this.corrected && this.corrected.size > 32) {
          for (var el of this.corrected) {
            if (!el.isConnected) this.corrected.delete(el);
          }
        }
        var role = node.getAttribute ? node.getAttribute('role') : null;
        if (role === 'menu' || role === 'listbox' || role === 'tooltip' || role === 'dialog' || role === 'alertdialog') {
          this.clampSoon(node);
        }
        if (node.querySelectorAll) {
          var found = node.querySelectorAll(this.ROLE_SELECTOR);
          for (var i = 0; i < found.length; i++) this.clampSoon(found[i]);
        }
      },
      start: function (doc, win) {
        this.doc = doc;
        this.win = win;
        this.corr = new WeakMap();
        this.corrected = new Set();
        var self = this;
        this.observer = new win.MutationObserver(function (records) {
          for (var i = 0; i < records.length; i++) {
            var added = records[i].addedNodes;
            for (var j = 0; j < added.length; j++) self.consider(added[j]);
          }
        });
        this.observer.observe(doc.body, { childList: true, subtree: true });
        this.consider(doc.body);
      },
      stop: function () {
        if (this.observer) this.observer.disconnect();
        this.observer = null;
        if (this.corrected) {
          for (var el of this.corrected) {
            if (el.isConnected) el.style.translate = '';
          }
          this.corrected.clear();
        }
        this.corr = null;
      },
    };

    var selectShim = {
      doc: null,
      win: null,
      popup: null,
      closePopup: function () {
        if (this.popup) this.popup.remove();
        this.popup = null;
        if (this.doc) this.doc.removeEventListener('pointerdown', this.onPopupDown, true);
        if (this.win) this.win.removeEventListener('keydown', this.onPopupKey, true);
      },
      onPopupDown: function (e) {
        if (selectShim.popup && !selectShim.popup.contains(e.target)) selectShim.closePopup();
      },
      onPopupKey: function (e) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          selectShim.closePopup();
        }
      },
      open: function (sel) {
        this.closePopup();
        var doc = this.doc;
        var win = this.win;
        var rect = sel.getBoundingClientRect();
        var pop = doc.createElement('div');
        pop.className = 'cordis-sflip-selectpop';
        pop.setAttribute('role', 'listbox');
        var current = sel.value;
        var self = this;
        for (var i = 0; i < sel.options.length; i++) (function (opt) {
          var item = doc.createElement('button');
          item.type = 'button';
          item.className = 'cordis-sflip-selectitem' + (opt.value === current ? ' is-current' : '');
          item.textContent = opt.textContent;
          item.disabled = opt.disabled;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', opt.value === current ? 'true' : 'false');
          item.addEventListener('click', function () {
            var desc = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value');
            if (desc && desc.set) desc.set.call(sel, opt.value);
            else sel.value = opt.value;
            sel.dispatchEvent(new win.Event('change', { bubbles: true }));
            self.closePopup();
          });
          pop.appendChild(item);
        })(sel.options[i]);
        pop.style.visibility = 'hidden';
        pop.style.minWidth = Math.max(rect.width, 140) + 'px';
        doc.body.appendChild(pop);
        var popW = pop.offsetWidth;
        var popH = pop.offsetHeight;
        var vw = win.innerWidth;
        var vh = win.innerHeight;
        var left = rect.left;
        if (left + popW > vw - 4) left = Math.max(4, vw - popW - 4);
        var top = rect.bottom + 4;
        if (top + popH > vh - 4) top = Math.max(4, rect.top - popH - 4);
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        pop.style.visibility = '';
        this.popup = pop;
        doc.addEventListener('pointerdown', this.onPopupDown, true);
        win.addEventListener('keydown', this.onPopupKey, true);
      },
      onMouseDown: function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var sel = t.closest('select');
        if (!sel || sel.disabled) return;
        if (!ctrl.col || !ctrl.col.contains(sel)) return;
        e.preventDefault();
        selectShim.open(sel);
      },
      start: function (doc, win) {
        this.doc = doc;
        this.win = win;
        doc.addEventListener('mousedown', this.onMouseDown, true);
      },
      stop: function () {
        if (this.doc) this.doc.removeEventListener('mousedown', this.onMouseDown, true);
        this.closePopup();
        this.doc = null;
        this.win = null;
      },
    };

    /* ── Page-lifetime attachment ─────────────────────────────────────── */

    function toggleOpen() {
      var next = !store.open;
      if (next && ctrl.frame && ctrl.frame.hasAttribute('data-sidebar-collapsed') && layoutSvc) {
        layoutSvc.toggleSidebar();
      }
      store.set('open', next);
    }

    /* The header whale lives in a session-scoped slot, so screens without a
     * session header (the hero / new-session main screen) would hide the
     * sidebar with no way back in. While the header toggle is absent we mount
     * a fixed-position fallback whale so the overlay stays reachable from
     * every screen. */
    var whaleFloat = {
      doc: null,
      win: null,
      btn: null,
      unsub: null,
      timer: 0,
      revealTimer: 0,
      missing: function () {
        return !!(ctrl.frame && !(store.whaleBtn && store.whaleBtn.isConnected));
      },
      paint: function () {
        if (!this.btn) return;
        var open = store.open;
        // While the overlay is open the product's own collapse toggle (top of
        // the revealed sidebar column) sits exactly under the float's corner —
        // hide the float for the duration instead of stacking two buttons.
        // Hiding is immediate (the column slides INTO the corner, so the float
        // must be gone before it arrives); revealing is DELAYED past the
        // column's slide-OUT transition (~220ms), otherwise the whale pops
        // back on top of the still-animating toggle — the overlap reappears
        // for the duration of the animation.
        if (this.revealTimer) { this.win.clearTimeout(this.revealTimer); this.revealTimer = 0; }
        if (open) {
          this.btn.classList.add('is-open');
        } else {
          var btn = this.btn;
          var self = this;
          this.btn.classList.add('is-open'); // stay hidden while sliding out
          this.revealTimer = this.win.setTimeout(function () {
            self.revealTimer = 0;
            if (!btn.isConnected) return;
            if (!store.open) btn.classList.remove('is-open'); // rapid re-open keeps it hidden
          }, 240);
        }
        var label = open ? '收起侧栏' : '弹出侧栏';
        this.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        this.btn.setAttribute('aria-label', label);
        this.btn.title = label;
      },
      mount: function () {
        var doc = this.doc;
        if (!doc || this.btn) return;
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'cordis-sflip-float';
        btn.innerHTML = '<svg width="20" height="14.71" viewBox="0 0 23.16 17.04" fill="none" aria-hidden="true"><path d="' + FISH_PATH + '" fill="currentColor"/></svg>';
        btn.addEventListener('click', toggleOpen);
        doc.body.appendChild(btn);
        this.btn = btn;
        this.paint();
      },
      unmount: function () {
        if (this.timer && this.win) { this.win.clearTimeout(this.timer); this.timer = 0; }
        if (this.revealTimer) { this.win.clearTimeout(this.revealTimer); this.revealTimer = 0; }
        if (this.btn) { this.btn.remove(); this.btn = null; }
      },
      sync: function () {
        if (!this.missing()) {
          this.unmount();
          return;
        }
        // Debounce the mount: session switches unmount/remount the header
        // whale within one tick, and flashing a fallback for that gap looks
        // broken. Unmount above stays immediate.
        if (this.btn || this.timer || !this.win) return;
        var self = this;
        this.timer = this.win.setTimeout(function () {
          self.timer = 0;
          if (self.missing()) self.mount();
        }, 150);
      },
      start: function (doc, win) {
        this.doc = doc;
        this.win = win;
        if (!this.unsub) {
          var self = this;
          this.unsub = store.subscribe(function () { self.paint(); });
        }
      },
      stop: function () {
        this.unmount();
        if (this.unsub) this.unsub();
        this.unsub = null;
        this.doc = null;
        this.win = null;
      },
    };

    function attachFrame(frame, doc, win) {
      var col = frame.firstElementChild;
      if (!col) return;
      ctrl.frame = frame;
      ctrl.col = col;
      ctrl.content = col.firstElementChild || null;
      ctrl.saved = {
        width: col.style.width,
        overflow: col.style.overflow,
        left: col.style.left,
        transform: col.style.transform,
        transition: col.style.transition,
        visibility: col.style.visibility,
        pointerEvents: col.style.pointerEvents,
        zIndex: col.style.zIndex,
        position: col.style.position,
        borderRight: col.style.borderRight,
        borderLeft: col.style.borderLeft,
        contentShadow: ctrl.content ? ctrl.content.style.boxShadow : '',
      };
      ctrl.lastCols = '';
      frame.classList.add('cordis-sflip-frame');
      col.style.position = 'relative';
      col.style.zIndex = '20';
      col.style.overflow = 'visible';
      syncCols();
      ctrl.mo = new win.MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].type === 'attributes' && records[i].attributeName === 'style') syncCols();
        }
      });
      ctrl.mo.observe(frame, { attributes: true, attributeFilter: ['style'] });
      // fixedAdapter is retired: it existed to re-anchor position:fixed
      // descendants that transform hijacked. The column now slides with
      // `left` (no fixed-containing-block ancestor), so product full-screen
      // modals are viewport-fixed again and must be left untouched — flipping
      // their left↔right would break the settings overlay's inset:0 mask.
      popupClamp.start(doc, win);
      selectShim.start(doc, win);
      ctrl.onResize = function () { applyCol(); };
      win.addEventListener('resize', ctrl.onResize);
      ctrl.onDocDown = function (e) {
        if (!store.open) return;
        var t = e.target;
        if (ctrl.col && ctrl.col.contains(t)) return;
        if (store.whaleBtn && store.whaleBtn.contains(t)) return;
        // Same for the floating fallback whale (screens without a session
        // header): pointerdown there must not count as an outside click.
        if (whaleFloat.btn && whaleFloat.btn.contains(t)) return;
        // The select-shim popup lives on <body> (outside the column) but is
        // part of the sidebar UI — picking an option must not dismiss us.
        if (selectShim.popup && selectShim.popup.contains(t)) return;
        store.set('open', false);
      };
      doc.addEventListener('pointerdown', ctrl.onDocDown, true);
      // The product's sidebar collapse toggle (the logoRow's last button) is
      // visible inside the open overlay and sits exactly where the floating
      // whale used to. Left alone, a click there flips the PRODUCT sidebar
      // state (rail width), which our column sync would misread as the
      // overlay width. While this plugin owns the sidebar geometry, that
      // button means OUR overlay — map its clicks to the overlay toggle.
      ctrl.onToggleClick = function (e) {
        var root = ctrl.content;
        if (!root || !root.isConnected) return;
        var row = root.firstElementChild;
        if (!row || !row.contains(e.target)) return;
        var btn = e.target.closest ? e.target.closest('button') : null;
        if (!btn || !row.contains(btn)) return;
        var btns = row.querySelectorAll('button');
        if (!btns.length || btn !== btns[btns.length - 1]) return; // brand stays with the product
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        store.set('open', false);
      };
      doc.addEventListener('click', ctrl.onToggleClick, true);
      // Page-lifetime geometry sync. WhaleToggle's subscription was the ONLY
      // thing re-applying the column on store changes — and that component
      // lives in the session-scoped header slot, which is ABSENT on the hero
      // / new-session screen. Toggling there desynced state from geometry
      // (column stuck on screen, store closed, every control dead). This
      // subscription outlives any header remount; applyCol is idempotent.
      ctrl.unsubStore = store.subscribe(function () { applyCol(); });
      store.set('active', true);
      applyCol();
      whaleFloat.start(doc, win);
      whaleFloat.sync();
    }

    function detachFrame(doc, win) {
      var frame = ctrl.frame;
      if (!frame) return;
      var col = ctrl.col;
      if (ctrl.mo) ctrl.mo.disconnect();
      ctrl.mo = null;
      popupClamp.stop();
      selectShim.stop();
      if (ctrl.onResize) win.removeEventListener('resize', ctrl.onResize);
      if (ctrl.onDocDown) doc.removeEventListener('pointerdown', ctrl.onDocDown, true);
      if (ctrl.onToggleClick) doc.removeEventListener('click', ctrl.onToggleClick, true);
      ctrl.onResize = null;
      ctrl.onDocDown = null;
      ctrl.onToggleClick = null;
      if (ctrl.unsubStore) ctrl.unsubStore();
      ctrl.unsubStore = null;
      store.set('active', false);
      frame.classList.remove('cordis-sflip-frame');
      if (ctrl.lastCols && frame.isConnected) frame.style.gridTemplateColumns = ctrl.lastCols;
      var s = ctrl.saved;
      if (s && col) {
        col.style.width = s.width;
        col.style.overflow = s.overflow;
        col.style.left = s.left;
        col.style.transform = s.transform;
        col.style.transition = s.transition;
        col.style.visibility = s.visibility;
        col.style.pointerEvents = s.pointerEvents;
        col.style.zIndex = s.zIndex;
        col.style.position = s.position;
        col.style.borderRight = s.borderRight;
        col.style.borderLeft = s.borderLeft;
        if (ctrl.content) ctrl.content.style.boxShadow = s.contentShadow;
      }
      ctrl.frame = null;
      ctrl.col = null;
      ctrl.content = null;
      ctrl.saved = null;
      ctrl.lastCols = '';
      whaleFloat.sync();
    }

    function findFrame(doc, win) {
      var overlays = doc.querySelectorAll('[data-shell-overlay]');
      for (var i = 0; i < overlays.length; i++) {
        var p = overlays[i].parentElement;
        if (!p) continue;
        var cs = win.getComputedStyle(p);
        if (cs.display === 'grid' && cs.gridTemplateColumns.indexOf(' ') >= 0) return p;
      }
      return null;
    }

    function manageAttachment(doc, win) {
      var tryAttach = function () {
        if (ctrl.frame && ctrl.frame.isConnected) return;
        if (ctrl.frame) detachFrame(doc, win);
        var frame = findFrame(doc, win);
        if (frame) attachFrame(frame, doc, win);
      };
      tryAttach();
      // Fresh-mount tracker for the header whale, by NODE IDENTITY. Plain
      // connectivity can miss a remount: on a session switch the old header
      // unmounts and the new one mounts within ONE React commit — refs run
      // (store.whaleBtn = newNode) before the observer callback, so boolean
      // connectivity reads true->true and the edge never fires. Comparing the
      // node itself catches that; same node across DOM churn (streaming
      // conversation) still never triggers anything.
      var lastWhaleNode = null;
      var mo = new win.MutationObserver(function () {
        whaleFloat.sync();
        // Auto-collapse on entering a session screen: the session header
        // mounts its own whale toggle, so an overlay left open would linger
        // over the conversation with its entry button duplicated in the
        // header. A FRESH whale node while we are open is exactly that
        // transition — close once. (The v0.1.3 steady-state test instead
        // closed on every body mutation while open, snapping a freshly
        // opened overlay shut the same tick — the whale read as dead.)
        var whaleNode = store.whaleBtn && store.whaleBtn.isConnected ? store.whaleBtn : null;
        if (store.open && whaleNode && whaleNode !== lastWhaleNode) {
          store.set('open', false);
        }
        lastWhaleNode = whaleNode;
        if (ctrl.frame && ctrl.frame.isConnected) return;
        tryAttach();
      });
      mo.observe(doc.body, { childList: true, subtree: true });
      return function () {
        mo.disconnect();
        detachFrame(doc, win);
        whaleFloat.stop();
      };
    }

    /* ── Components ───────────────────────────────────────────────────── */

    function WhaleToggle() {
      var bagRef = React.useState(function () { return { btn: null }; });
      var bag = bagRef[0];
      var openState = React.useState(store.open);
      var open = openState[0];
      var setOpenState = openState[1];

      React.useEffect(function () {
        return store.subscribe(function () {
          setOpenState(store.open);
          applyCol();
        });
      }, []);

      var onClick = function () { toggleOpen(); };

      var label = open ? '收起侧栏' : '弹出侧栏';
      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'cordis-sflip-whale',
          ref: function (node) { bag.btn = node; store.whaleBtn = node; },
          onClick: onClick,
          'aria-expanded': open ? 'true' : 'false',
          'aria-label': label,
          title: label,
        },
        React.createElement('svg', {
          width: 20,
          height: 14.71,
          viewBox: '0 0 23.16 17.04',
          fill: 'none',
          'aria-hidden': 'true',
        }, React.createElement('path', { d: FISH_PATH, fill: 'currentColor' }))
      );
    }

    function SideSwitch(props) {
      var bagRef = React.useState(function () { return { marker: null, row: null, btn: null, iconEl: null, labelEl: null }; });
      var bag = bagRef[0];
      var activeState = React.useState(store.active);
      var active = activeState[0];
      var setActive = activeState[1];

      var paint = function () {
        if (!bag.btn) return;
        var toLeft = store.side !== 'left';
        var label = toLeft ? '侧栏移到左侧' : '侧栏移到右侧';
        if (bag.iconEl) bag.iconEl.innerHTML = sideIcon(toLeft ? 'left' : 'right');
        if (bag.labelEl) bag.labelEl.textContent = label;
        bag.btn.setAttribute('aria-label', label);
        bag.btn.title = label;
      };

      React.useEffect(function () {
        return store.subscribe(function () {
          setActive(store.active);
          paint();
        });
      }, []);

      React.useEffect(function () {
        if (!active) return undefined;
        var marker = bag.marker;
        if (!marker) return undefined;
        var doc = marker.ownerDocument;
        var win = doc.defaultView;
        var frame = null;
        var node = marker.parentElement;
        while (node && node !== doc.body) {
          var cs = win.getComputedStyle(node);
          if (cs.display === 'grid' && cs.gridTemplateColumns.indexOf(' ') >= 0) frame = node;
          node = node.parentElement;
        }
        if (!frame) return undefined;
        var col = marker;
        while (col && col.parentElement !== frame) col = col.parentElement;
        if (!col) return undefined;
        var root = col.firstElementChild;
        while (root && root.children.length === 1 && root.firstElementChild) root = root.firstElementChild;
        if (!root || root.children.length < 3 || !root.contains(marker)) return undefined;
        var row = doc.createElement('div');
        row.className = 'cordis-sflip-row';
        row.setAttribute('data-wide', props.wide ? 'true' : 'false');
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'cordis-sflip-sidebtn';
        var iconEl = doc.createElement('span');
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.style.display = 'inline-flex';
        var labelEl = doc.createElement('span');
        labelEl.style.display = props.wide ? '' : 'none';
        btn.appendChild(iconEl);
        btn.appendChild(labelEl);
        btn.addEventListener('click', function () {
          store.set('side', store.side === 'left' ? 'right' : 'left');
        });
        row.appendChild(btn);
        root.insertBefore(row, root.lastElementChild);
        bag.row = row;
        bag.btn = btn;
        bag.iconEl = iconEl;
        bag.labelEl = labelEl;
        paint();
        return function () {
          row.remove();
          bag.row = null;
          bag.btn = null;
          bag.iconEl = null;
          bag.labelEl = null;
        };
      }, [active]);

      React.useEffect(function () {
        if (bag.row) bag.row.setAttribute('data-wide', props.wide ? 'true' : 'false');
        if (bag.labelEl) bag.labelEl.style.display = props.wide ? '' : 'none';
      }, [props.wide]);

      return React.createElement('span', {
        className: 'cordis-sflip-marker',
        ref: function (node) { bag.marker = node; },
      });
    }

    function apply(ctx) {
      layoutSvc = ctx.layout;
      var slots = ctx.slots;
      ctx.effect(function () {
        var el = document.createElement('style');
        el.textContent = CSS;
        document.head.appendChild(el);
        return function () { el.remove(); };
      });
      ctx.effect(function () {
        return manageAttachment(document, window);
      });
      ctx.effect(function () {
        return slots.inject('conversation.session.header.utilities', function () {
          return slots.register(
            { name: 'conversation.session.header.utilities', id: 'sidebar-whale-toggle', order: 10, label: '侧栏' },
            function () { return React.createElement(WhaleToggle); }
          );
        });
      });
      ctx.effect(function () {
        return slots.inject('sidebar.footer.action', function () {
          return slots.register(
            { name: 'sidebar.footer.action', id: 'sidebar-flip', order: 10, label: '切换侧栏左右位置' },
            function (ownerProps) { return React.createElement(SideSwitch, { wide: !!(ownerProps && ownerProps.wide) }); }
          );
        });
      });
    }

    var inject = ['slots', 'layout'];
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
