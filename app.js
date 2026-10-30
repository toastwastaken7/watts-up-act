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

/* ===== Motion layer (home page): intro, circuit canvas, parallax, live ticker ===== */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  var isHome = body.classList.contains('home');

  /* ---------- Intro: lightning strike that powers the page on ---------- */
  var intro = document.getElementById('intro');
  var seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
  function finishIntro() {
    body.classList.remove('intro-running');
    body.classList.add('hero-in');
    if (intro) { intro.classList.add('is-off'); setTimeout(function () { intro.classList.remove('is-on'); intro.classList.remove('is-off'); }, 800); }
  }
  if (intro && isHome && !reduce && !seen) {
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    body.classList.add('intro-running');
    intro.classList.add('is-on');
    var c = document.getElementById('introCanvas'), ctx = c.getContext('2d');
    var W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    // Build a jagged bolt from (x0,y0) to (x1,y1) with branches.
    function bolt(x0, y0, x1, y1, depth, out) {
      var pts = [[x0, y0]], segs = 14, dx = (x1 - x0) / segs, dy = (y1 - y0) / segs, len = Math.hypot(x1 - x0, y1 - y0);
      for (var i = 1; i < segs; i++) {
        var px = x0 + dx * i, py = y0 + dy * i;
        var jitter = (Math.random() - 0.5) * len * 0.12;
        pts.push([px + jitter * (dy / len) * -1, py + jitter * (dx / len)]);
        if (depth > 0 && Math.random() < 0.28) {
          var last = pts[pts.length - 1];
          var ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4, bl = len * (0.25 + Math.random() * 0.25);
          bolt(last[0], last[1], last[0] + Math.cos(ang) * bl, last[1] + Math.sin(ang) * bl, depth - 1, out);
        }
      }
      pts.push([x1, y1]); out.push({ pts: pts, w: depth === 2 ? 3.6 : depth === 1 ? 1.9 : 1.1 });
    }
    var strikes = [], t0 = performance.now(), flashes = [{ at: 520 }, { at: 760 }, { at: 980 }];
    function newStrike() { var out = []; var sx = W * (0.35 + Math.random() * 0.3); bolt(sx, -10, W * (0.4 + Math.random() * 0.2), H * (0.62 + Math.random() * 0.1), 2, out); return { bolts: out, born: performance.now(), life: 340 + Math.random() * 220 }; }
    var nextStrike = 420;
    function frame(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      // faint energized grid that brightens over time
      var g = Math.min(t / 1400, 1);
      ctx.strokeStyle = 'rgba(158,197,244,' + (0.04 + 0.1 * g) + ')'; ctx.lineWidth = 1;
      for (var x = (W / 2) % 48; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      if (t > nextStrike && strikes.length < 3) { strikes.push(newStrike()); nextStrike = t + 180 + Math.random() * 220; }
      strikes.forEach(function (s) {
        var age = now - s.born, a = Math.max(0, 1 - age / s.life);
        if (a <= 0) return;
        s.bolts.forEach(function (b) {
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.shadowColor = 'rgba(158,197,244,' + a + ')'; ctx.shadowBlur = 32;
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.95 * a) + ')'; ctx.lineWidth = b.w;
          ctx.beginPath(); b.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
          ctx.shadowBlur = 0;
        });
      });
      flashes.forEach(function (f) { var d = t - f.at; if (d > 0 && d < 140) { ctx.fillStyle = 'rgba(205,226,251,' + (0.35 * (1 - d / 140)) + ')'; ctx.fillRect(0, 0, W, H); } });
      // power-on glow rising from the bottom
      if (t > 1000) { var p = Math.min((t - 1000) / 600, 1); var grad = ctx.createLinearGradient(0, H, 0, H * (1 - 0.7 * p)); grad.addColorStop(0, 'rgba(42,120,214,' + (0.55 * p) + ')'); grad.addColorStop(1, 'rgba(42,120,214,0)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); }
      if (t < 1700) requestAnimationFrame(frame); else finishIntro();
    }
    requestAnimationFrame(frame);
    window.addEventListener('resize', size);
    setTimeout(finishIntro, 2600); // safety net
  } else {
    body.classList.add('hero-in');
  }

  /* ---------- Scroll parallax for [data-speed] elements ---------- */
  var par = Array.prototype.slice.call(document.querySelectorAll('[data-speed]'));
  var lastY = window.scrollY || 0, velocity = 0, ticking = false;
  function applyParallax() {
    var y = window.scrollY || 0;
    par.forEach(function (el) {
      var s = parseFloat(el.getAttribute('data-speed')) || 0;
      el.style.transform = 'translate3d(0,' + (y * s).toFixed(1) + 'px,0)' + (el.classList.contains('bolt-b') ? ' rotate(14deg)' : el.classList.contains('bolt-c') ? ' rotate(-10deg)' : '');
    });
    ticking = false;
  }
  if (!reduce && par.length) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY || 0; velocity = velocity * 0.6 + (y - lastY) * 0.4; lastY = y;
      if (!ticking) { ticking = true; requestAnimationFrame(applyParallax); }
    }, { passive: true });
    applyParallax();
  }

  /* ---------- Circuit-trace canvas with flowing electrons ---------- */
  var cc = document.getElementById('circuitCanvas');
  if (cc && !reduce) {
    var cx = cc.getContext('2d'), CW, CH, traces = [], dots = [], dpr2 = Math.min(window.devicePixelRatio || 1, 1.5);
    function csize() {
      CW = window.innerWidth; CH = window.innerHeight; cc.width = CW * dpr2; cc.height = CH * dpr2; cx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      traces = []; dots = [];
      var n = CW < 700 ? 5 : 9;
      for (var i = 0; i < n; i++) {
        // orthogonal path: start left/right edge, several right-angle turns
        var pts = [], x = Math.random() < 0.5 ? -20 : CW + 20, y = Math.random() * CH, dir = x < 0 ? 1 : -1;
        pts.push([x, y]);
        for (var k = 0; k < 5; k++) {
          x += dir * (80 + Math.random() * 220); pts.push([x, y]);
          y += (Math.random() - 0.5) * 260; pts.push([x, y]);
        }
        x += dir * 400; pts.push([x, y]);
        var len = 0, cum = [0];
        for (var j = 1; j < pts.length; j++) { len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); cum.push(len); }
        traces.push({ pts: pts, cum: cum, len: len });
        for (var d = 0; d < 3; d++) dots.push({ t: i, p: Math.random(), v: 0.0006 + Math.random() * 0.0008 });
      }
    }
    function posOn(tr, f) {
      var dist = f * tr.len;
      for (var j = 1; j < tr.cum.length; j++) {
        if (dist <= tr.cum[j]) { var a = tr.pts[j - 1], b = tr.pts[j], u = (dist - tr.cum[j - 1]) / (tr.cum[j] - tr.cum[j - 1] || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
      }
      return tr.pts[tr.pts.length - 1];
    }
    var running = true;
    function cframe() {
      if (!running) return;
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      var scrollY = window.scrollY || 0;
      cx.clearRect(0, 0, CW, CH);
      cx.lineWidth = 1; cx.strokeStyle = dark ? 'rgba(158,197,244,0.10)' : 'rgba(42,120,214,0.12)';
      var shift = (scrollY * 0.15) % CH;
      traces.forEach(function (tr) {
        cx.beginPath();
        tr.pts.forEach(function (p, i) { var yy = ((p[1] - shift) % CH + CH) % CH; if (i && Math.abs(yy - (((tr.pts[i - 1][1] - shift) % CH + CH) % CH)) > CH / 2) cx.moveTo(p[0], yy); else if (i) cx.lineTo(p[0], yy); else cx.moveTo(p[0], yy); });
        cx.stroke();
      });
      var boost = 1 + Math.min(Math.abs(velocity) / 12, 6);
      velocity *= 0.92;
      dots.forEach(function (d) {
        d.p += d.v * boost; if (d.p > 1) d.p = 0;
        var tr = traces[d.t], q = posOn(tr, d.p), yy = ((q[1] - shift) % CH + CH) % CH;
        cx.beginPath(); cx.fillStyle = dark ? 'rgba(158,197,244,0.9)' : 'rgba(42,120,214,0.75)';
        cx.shadowColor = dark ? '#9ec5f4' : '#2a78d6'; cx.shadowBlur = 10;
        cx.arc(q[0], yy, 2.2, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0;
      });
      requestAnimationFrame(cframe);
    }
    csize(); cframe();
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(csize, 150); });
    document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) cframe(); });
  }

  /* ---------- Live ticker ---------- */
  var kwhEl = document.getElementById('liveKwh');
  if (kwhEl) {
    var SEC_YEAR = 365.25 * 86400;
    var KWH_PER_SEC = 176e9 / SEC_YEAR;        // 176 TWh/yr -> kWh per second (~5,570)
    var GAL_PER_SEC = (66e9 * 0.264172) / SEC_YEAR; // 66 B liters/yr -> gallons per second (~553)
    var start = Date.now();
    var fmt = function (n, d) { return n.toLocaleString(undefined, { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); };
    var yearEl = document.getElementById('liveYear'), yearEl2 = document.getElementById('liveYear2');
    function tick() {
      var now = Date.now(), s = (now - start) / 1000;
      var kwh = s * KWH_PER_SEC, gal = s * GAL_PER_SEC;
      kwhEl.textContent = fmt(kwh);
      document.getElementById('liveHomes').textContent = fmt(kwh / 29); // ~29 kWh per U.S. home per day
      document.getElementById('liveGal').textContent = fmt(gal);
      document.getElementById('livePools').textContent = fmt(gal / 40); // ~40 gallons per bath
      var yr = new Date(now).getFullYear(), jan1 = new Date(yr, 0, 1).getTime(), ys = (now - jan1) / 1000;
      var ytdMwh = ys * KWH_PER_SEC / 1000, ytdGal = ys * GAL_PER_SEC;
      document.getElementById('liveYtd').textContent = fmt(ytdMwh / 1000);
      document.getElementById('liveYtdTwh').textContent = fmt(ytdMwh / 1e6, 2);
      document.getElementById('liveYtdGal').textContent = fmt(ytdGal / 1e6, 1);
      document.getElementById('liveYtdOlympic').textContent = fmt(ytdGal / 660000); // 660,000 gal per Olympic pool
      if (yearEl) yearEl.textContent = yr; if (yearEl2) yearEl2.textContent = yr;
    }
    tick(); setInterval(tick, 100);
  }
})();
