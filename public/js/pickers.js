/**
 * Composants de formulaire personnalisés, aux couleurs du site :
 *  - menus déroulants (<select class="js-select">) -> liste stylée ;
 *  - sélecteur de date ([data-datepick] contenant un <input type="hidden">) ->
 *    petit calendrier stylé.
 *
 * Les valeurs restent portées par les éléments natifs (select / input hidden),
 * donc la lecture `element.value` côté formulaire ne change pas.
 *
 * API globale :
 *   Pickers.initAll(root)        enrichit les contrôles présents dans `root`
 *   Pickers.sync()               resynchronise l'affichage (après form.reset)
 *   Pickers.setValue(el, value)  fixe une valeur programmatique proprement
 */
(function () {
  const registry = []; // { el, render, close }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function closeAll() {
    registry.forEach((r) => r.close());
  }

  /* ----------------------- Menu déroulant custom ----------------------- */
  function fillTimeOptions(select) {
    const frag = document.createDocumentFragment();
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 5) {
        const v = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        frag.appendChild(o);
      }
    }
    select.appendChild(frag);
  }

  function initSelect(select) {
    if (select.dataset.enh) return;
    select.dataset.enh = '1';
    if (select.hasAttribute('data-time')) fillTimeOptions(select);
    // Un <select required> masqué (display:none) bloquerait la soumission :
    // on retire `required`, la validation est faite manuellement en JS.
    select.removeAttribute('required');
    select.classList.add('cselect-native');

    const wrap = document.createElement('div');
    wrap.className = 'cselect';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cselect-trigger';
    const menu = document.createElement('div');
    menu.className = 'cselect-menu';
    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    function render() {
      const opt = select.options[select.selectedIndex];
      const placeholder = !select.value;
      trigger.innerHTML =
        `<span class="cselect-label${placeholder ? ' is-placeholder' : ''}">${esc(opt ? opt.textContent : '')}</span>` +
        `<span class="material-symbols-rounded cselect-caret">expand_more</span>`;
      menu.innerHTML = '';
      Array.from(select.options).forEach((o) => {
        if (o.disabled && o.value === '') return; // on masque le placeholder dans la liste
        const it = document.createElement('button');
        it.type = 'button';
        it.className = 'cselect-option' + (o.value === select.value ? ' selected' : '');
        it.textContent = o.textContent;
        it.addEventListener('click', () => {
          select.value = o.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
        menu.appendChild(it);
      });
    }
    function open() {
      closeAll();
      wrap.classList.add('open');
      const sel = menu.querySelector('.cselect-option.selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    function close() {
      wrap.classList.remove('open');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.contains('open') ? close() : open();
    });
    select.addEventListener('change', render);
    registry.push({ el: wrap, render, close });
    render();
  }

  /* --------------------------- Sélecteur de date --------------------------- */
  const WKD = [6, 0, 1, 2, 3, 4, 5]; // getDay() dim=0 -> colonne (semaine L→D)
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const fmtLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  function keyOf(d) {
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function initDate(container) {
    if (container.dataset.enh) return;
    container.dataset.enh = '1';
    const input = container.querySelector('input[type="hidden"]');
    const placeholder = container.dataset.placeholder || 'Choisir une date';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'picker-trigger';
    const pop = document.createElement('div');
    pop.className = 'dp-pop';
    container.appendChild(trigger);
    container.appendChild(pop);

    let view = new Date();
    view.setDate(1);

    function renderTrigger() {
      const v = input.value;
      const label = v ? cap(fmtLong.format(new Date(v + 'T00:00:00'))) : placeholder;
      trigger.innerHTML =
        `<span class="picker-value${v ? '' : ' is-placeholder'}">${esc(label)}</span>` +
        `<span class="material-symbols-rounded">calendar_month</span>`;
    }
    function renderGrid() {
      const y = view.getFullYear();
      const m = view.getMonth();
      const first = new Date(y, m, 1);
      const days = new Date(y, m + 1, 0).getDate();
      const lead = WKD[first.getDay()];
      const todayKey = keyOf(new Date());
      const selKey = input.value;
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span class="dp-cell dp-empty"></span>';
      for (let d = 1; d <= days; d++) {
        const k = keyOf(new Date(y, m, d));
        cells +=
          `<button type="button" class="dp-cell${k === todayKey ? ' today' : ''}` +
          `${k === selKey ? ' selected' : ''}" data-k="${k}">${d}</button>`;
      }
      pop.innerHTML =
        `<div class="dp-head">` +
        `<button type="button" class="dp-nav" data-prev><span class="material-symbols-rounded">chevron_left</span></button>` +
        `<span class="dp-month">${esc(cap(fmtMonth.format(view)))}</span>` +
        `<button type="button" class="dp-nav" data-next><span class="material-symbols-rounded">chevron_right</span></button>` +
        `</div>` +
        `<div class="dp-weekdays"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>` +
        `<div class="dp-grid">${cells}</div>`;
      pop.querySelector('[data-prev]').addEventListener('click', (e) => {
        e.stopPropagation();
        view = new Date(y, m - 1, 1);
        renderGrid();
      });
      pop.querySelector('[data-next]').addEventListener('click', (e) => {
        e.stopPropagation();
        view = new Date(y, m + 1, 1);
        renderGrid();
      });
      pop.querySelectorAll('.dp-cell[data-k]').forEach((c) => {
        c.addEventListener('click', () => {
          input.value = c.dataset.k;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
      });
    }
    function open() {
      closeAll();
      if (input.value) {
        const dv = new Date(input.value + 'T00:00:00');
        view = new Date(dv.getFullYear(), dv.getMonth(), 1);
      }
      renderGrid();
      container.classList.add('open');
    }
    function close() {
      container.classList.remove('open');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.contains('open') ? close() : open();
    });
    input.addEventListener('change', renderTrigger);
    registry.push({ el: container, render: renderTrigger, close });
    renderTrigger();
  }

  /* ------------------------------- API ------------------------------- */
  function initAll(root) {
    root = root || document;
    root.querySelectorAll('select.js-select').forEach(initSelect);
    root.querySelectorAll('[data-datepick]').forEach(initDate);
  }
  function sync() {
    registry.forEach((r) => r.render());
  }
  function setValue(el, value) {
    if (!el) return;
    value = value || '';
    if (el.tagName === 'SELECT' && value && !Array.from(el.options).some((o) => o.value === value)) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = value;
      el.appendChild(o);
    }
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  window.Pickers = { initAll, sync, setValue };
  initAll();
})();
