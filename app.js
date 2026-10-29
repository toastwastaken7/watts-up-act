/* WATTS UP Act — site script. Vanilla JS, no dependencies. */
(function () {
  'use strict';

  /* ---------- Theme ---------- */
  var root = document.documentElement;
  function getStored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setStored(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function applyTheme(t) { root.setAttribute('data-theme', t); var b = document.getElementById('themeBtn'); if (b) b.textContent = t === 'dark' ? '☀' : '☾'; }
  var stored = getStored('theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored || (prefersDark ? 'dark' : 'light'));
  document.addEventListener('click', function (e) {
    var t = e.target.closest('#themeBtn'); if (!t) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next); setStored('theme', next);
    if (window.__redrawChart) window.__redrawChart();
  });

  /* ---------- Mobile menu ---------- */
  document.addEventListener('click', function (e) {
    var m = e.target.closest('#menuBtn');
    var links = document.getElementById('navLinks');
    if (m && links) { links.classList.toggle('open'); return; }
    if (links && links.classList.contains('open') && !e.target.closest('.nav')) links.classList.remove('open');
  });

  /* ---------- Reading progress ---------- */
  var prog = document.getElementById('progress');
  function onScroll() {
    if (!prog) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }
  // Safety net: never leave content hidden if the observer doesn't fire for any reason.
  setTimeout(function () { reveals.forEach(function (el) { el.classList.add('in'); }); }, 2000);

  /* ---------- Animated counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var dur = 1400, start = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = target.toFixed(decimals); return; }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); } });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { cio.observe(el); });
    } else { counters.forEach(animateCount); }
  }

  /* ---------- Energy chart (SVG, single series + projection band) ---------- */
  var chartEl = document.getElementById('energyChart');
  if (chartEl) {
    // Source: Shehabi et al., 2024 United States Data Center Energy Usage Report (LBNL, Dec. 2024)
    var actual = [ { y: 2014, v: 58 }, { y: 2018, v: 76 }, { y: 2023, v: 176 } ];
    var proj = { y: 2028, lo: 325, hi: 580 };
    var share = { 2014: '1.5%', 2018: '1.9%', 2023: '4.4%', 2028: '6.7% – 12%' };

    function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

    function draw() {
      var W = 720, H = 360, padL = 56, padR = 24, padT = 24, padB = 44;
      var x0 = 2013, x1 = 2029, yMax = 620;
      function X(y) { return padL + (y - x0) / (x1 - x0) * (W - padL - padR); }
      function Y(v) { return padT + (1 - v / yMax) * (H - padT - padB); }
      var accent = css('--accent'), grid = css('--chart-grid'), axis = css('--chart-axis'), muted = css('--muted'), ink = css('--ink-2');
      var s = '';
      s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chartTitle chartDesc">';
      s += '<title id="chartTitle">U.S. data center electricity use, 2014 to 2028</title>';
      s += '<desc id="chartDesc">Line chart rising from 58 terawatt-hours in 2014 to 176 in 2023, with a projected range of 325 to 580 terawatt-hours in 2028.</desc>';
      // grid
      [0, 100, 200, 300, 400, 500, 600].forEach(function (v) {
        s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (v === 0 ? axis : grid) + '" stroke-width="1"/>';
        s += '<text x="' + (padL - 10) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="' + muted + '" style="font-variant-numeric:tabular-nums">' + v + '</text>';
      });
      [2014, 2016, 2018, 2020, 2022, 2024, 2026, 2028].forEach(function (y) {
        s += '<text x="' + X(y) + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="11" fill="' + muted + '">' + y + '</text>';
      });
      s += '<text x="' + padL + '" y="' + 12 + '" font-size="11" fill="' + muted + '">TWh per year</text>';
      // projection band (2023 -> 2028)
      var last = actual[actual.length - 1];
      s += '<path d="M' + X(last.y) + ',' + Y(last.v) + ' L' + X(proj.y) + ',' + Y(proj.hi) + ' L' + X(proj.y) + ',' + Y(proj.lo) + ' Z" fill="' + accent + '" opacity="0.16"/>';
      // actual line
      var d = actual.map(function (p, i) { return (i ? 'L' : 'M') + X(p.y) + ',' + Y(p.v); }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="' + accent + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      // projection dashed midline
      var mid = (proj.lo + proj.hi) / 2;
      s += '<path d="M' + X(last.y) + ',' + Y(last.v) + ' L' + X(proj.y) + ',' + Y(mid) + '" fill="none" stroke="' + accent + '" stroke-width="2" stroke-dasharray="5 5"/>';
      // markers
      actual.forEach(function (p) {
        s += '<circle cx="' + X(p.y) + '" cy="' + Y(p.v) + '" r="5" fill="' + accent + '" stroke="' + css('--surface') + '" stroke-width="2"/>';
      });
      s += '<circle cx="' + X(proj.y) + '" cy="' + Y(proj.lo) + '" r="4.5" fill="' + css('--surface') + '" stroke="' + accent + '" stroke-width="2"/>';
      s += '<circle cx="' + X(proj.y) + '" cy="' + Y(proj.hi) + '" r="4.5" fill="' + css('--surface') + '" stroke="' + accent + '" stroke-width="2"/>';
      // selective direct labels
      s += '<text x="' + (X(2023) - 10) + '" y="' + (Y(176) - 12) + '" text-anchor="end" font-size="12" font-weight="600" fill="' + ink + '">176 TWh (4.4%)</text>';
      s += '<text x="' + (X(2028) - 10) + '" y="' + (Y(580) - 10) + '" text-anchor="end" font-size="12" font-weight="600" fill="' + ink + '">up to 580 TWh (12%)</text>';
      s += '<text x="' + (X(2028) - 10) + '" y="' + (Y(325) + 18) + '" text-anchor="end" font-size="12" fill="' + ink + '">at least 325 TWh</text>';
      s += '<text x="' + (X(2014) + 10) + '" y="' + (Y(58) - 10) + '" font-size="12" fill="' + ink + '">58 TWh</text>';
      // hover targets (invisible wide columns)
      var pts = actual.concat([{ y: proj.y, v: mid, range: true }]);
      pts.forEach(function (p, i) {
        var cx = X(p.y);
        s += '<rect data-i="' + i + '" x="' + (cx - 22) + '" y="' + padT + '" width="44" height="' + (H - padT - padB) + '" fill="transparent" style="cursor:crosshair"/>';
      });
      s += '</svg><div class="tip" id="chartTip"></div>';
      chartEl.innerHTML = s;

      var tip = document.getElementById('chartTip');
      var svg = chartEl.querySelector('svg');
      chartEl.querySelectorAll('rect[data-i]').forEach(function (r) {
        var i = parseInt(r.getAttribute('data-i'), 10), p = pts[i];
        function show() {
          var box = svg.getBoundingClientRect();
          var sx = box.width / W;
          var left = X(p.y) * sx, top = Y(p.range ? proj.hi : p.v) * sx;
          tip.style.left = left + 'px'; tip.style.top = top + 'px';
          tip.innerHTML = '<b>' + p.y + (p.range ? ' (projected)' : '') + '</b>' +
            (p.range ? proj.lo + ' – ' + proj.hi + ' TWh' : p.v + ' TWh') +
            '<br>' + share[p.y] + ' of U.S. electricity';
          tip.classList.add('show');
        }
        r.addEventListener('mouseenter', show);
        r.addEventListener('touchstart', show, { passive: true });
        r.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      });
    }
    draw();
    window.__redrawChart = draw;
    var tbtn = document.getElementById('tableToggle'), tbl = document.getElementById('chartTable');
    if (tbtn && tbl) tbtn.addEventListener('click', function () {
      var hidden = tbl.hasAttribute('hidden');
      if (hidden) tbl.removeAttribute('hidden'); else tbl.setAttribute('hidden', '');
      tbtn.textContent = hidden ? 'Hide data table' : 'View as table';
    });
  }

  /* ---------- Fee calculator ---------- */
  var slider = document.getElementById('mwSlider');
  if (slider) {
    var HOURS = 8760, LOAD = 0.8, FEE = 1.0, HOMES_PER_MW = 800; // 50 MW ≈ 40,000 homes
    function fmtMoney(n) { if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + ' B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + ' M'; return '$' + Math.round(n).toLocaleString(); }
    function fmtNum(n) { return Math.round(n).toLocaleString(); }
    function update() {
      var mw = parseInt(slider.value, 10);
      var mwh = mw * HOURS * LOAD;
      var fee = mwh * FEE;
      document.getElementById('mwOut').textContent = mw + ' MW';
      document.getElementById('rHomes').textContent = fmtNum(mw * HOMES_PER_MW);
      document.getElementById('rMwh').textContent = fmtNum(mwh);
      document.getElementById('rFee').textContent = fmtMoney(fee);
      document.getElementById('rBillShare').textContent = '$0';
      document.getElementById('rCovered').textContent = mw >= 50 ? 'Yes — covered' : 'No — below 50 MW';
      var covered = document.getElementById('rCoveredBox');
      if (covered) covered.style.outline = mw >= 50 ? '2px solid var(--accent)' : '2px solid transparent';
      var nat = 176e6 * FEE; // national fee pool, 2023 usage
      var pct = Math.min(fee / nat * 100, 100);
      var share = document.getElementById('rShare'); if (share) share.textContent = pct.toFixed(2) + '%';
    }
    slider.addEventListener('input', update); update();
  }

  /* ---------- Bill page: collapsible sections, TOC highlight, tools ---------- */
  var sections = document.querySelectorAll('.bill-section');
  if (sections.length) {
    sections.forEach(function (sec) {
      var h = sec.querySelector('h2');
      h.setAttribute('tabindex', '0'); h.setAttribute('role', 'button'); h.setAttribute('aria-expanded', 'true');
      function toggle() { sec.classList.toggle('collapsed'); h.setAttribute('aria-expanded', String(!sec.classList.contains('collapsed'))); }
      h.addEventListener('click', toggle);
      h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    var expandAll = document.getElementById('expandAll'), collapseAll = document.getElementById('collapseAll');
    if (expandAll) expandAll.addEventListener('click', function () { sections.forEach(function (s) { s.classList.remove('collapsed'); s.querySelector('h2').setAttribute('aria-expanded', 'true'); }); });
    if (collapseAll) collapseAll.addEventListener('click', function () { sections.forEach(function (s) { s.classList.add('collapsed'); s.querySelector('h2').setAttribute('aria-expanded', 'false'); }); });
    var plainBtn = document.getElementById('plainToggle');
    if (plainBtn) plainBtn.addEventListener('click', function () {
      var on = document.body.classList.toggle('show-plain');
      plainBtn.textContent = on ? 'Hide plain-English notes' : 'Show plain-English notes';
      document.querySelectorAll('.bill-section .plain').forEach(function (p) { p.style.display = on ? 'block' : 'none'; });
    });
    document.querySelectorAll('.bill-section .plain').forEach(function (p) { p.style.display = 'none'; });
    // TOC active state
    var tocLinks = document.querySelectorAll('.toc a[href^="#"]');
    if ('IntersectionObserver' in window && tocLinks.length) {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
      sections.forEach(function (s) { sio.observe(s); });
    }
    // Copy bill text
    var copyBtn = document.getElementById('copyBill');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var paper = document.querySelector('.bill-paper');
      var clone = paper.cloneNode(true);
      clone.querySelectorAll('.plain, .chev').forEach(function (n) { n.remove(); });
      var text = clone.innerText.replace(/\n{3,}/g, '\n\n');
      function done(ok) { var t = document.getElementById('toast'); if (!t) return; t.textContent = ok ? 'Bill text copied to clipboard' : 'Copy failed — select the text manually'; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2200); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }

  /* ---------- Footer year ---------- */
  var yr = document.getElementById('year'); if (yr) yr.textContent = String(new Date().getFullYear());
})();
