/* Alat pena untuk presentasi dan peta bertitik (hotspot) dengan penjelasan. */
(function () {
  'use strict';

  /* ---------- Alat pena ---------- */
  var COLORS = [
    { name: 'Merah', value: '#d62828' },
    { name: 'Biru', value: '#1d4ed8' },
    { name: 'Hitam', value: '#111827' },
    { name: 'Stabilo kuning', value: 'rgba(250, 204, 21, 0.45)', marker: true }
  ];
  var strokes = [];        // setiap goresan: {color, width, points:[[x,y],...]} dalam koordinat halaman
  var current = null;
  var active = false;
  var color = COLORS[0];
  var canvas, ctx, bar, penBtn;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function drawStroke(s) {
    var pts = s.points;
    if (!pts.length) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0] - window.scrollX, pts[0][1] - window.scrollY);
    if (pts.length === 1) ctx.lineTo(pts[0][0] - window.scrollX + 0.1, pts[0][1] - window.scrollY);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - window.scrollX, pts[i][1] - window.scrollY);
    ctx.stroke();
  }

  var pending = false;
  function draw() {
    pending = false;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    strokes.forEach(drawStroke);
    if (current) drawStroke(current);
  }
  function requestDraw() {
    if (!pending) { pending = true; window.requestAnimationFrame(draw); }
  }

  function setActive(on) {
    active = on;
    canvas.classList.toggle('pen-on', on);
    penBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    penBtn.textContent = on ? '✎ Pena aktif' : '✎ Pena';
    bar.classList.toggle('open', on);
  }

  function undo() { strokes.pop(); requestDraw(); }
  function clearAll() { strokes = []; requestDraw(); }

  function initPen() {
    canvas = el('canvas', { 'class': 'pen-canvas', 'aria-hidden': 'true' });
    ctx = canvas.getContext('2d');
    bar = el('div', { 'class': 'pen-bar', role: 'toolbar', 'aria-label': 'Alat pena untuk presentasi' });
    penBtn = el('button', { type: 'button', 'class': 'pen-toggle', 'aria-pressed': 'false', title: 'Pena (P)' }, '✎ Pena');
    var tools = el('div', { 'class': 'pen-tools' });
    COLORS.forEach(function (c, i) {
      var b = el('button', { type: 'button', 'class': 'pen-color' + (i === 0 ? ' selected' : ''), title: c.name, 'aria-label': c.name });
      b.style.background = c.value;
      b.addEventListener('click', function () {
        color = c;
        tools.querySelectorAll('.pen-color').forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        if (!active) setActive(true);
      });
      tools.appendChild(b);
    });
    var undoBtn = el('button', { type: 'button', title: 'Batalkan goresan terakhir (Ctrl+Z)' }, '↶ Undo');
    var clearBtn = el('button', { type: 'button', title: 'Hapus semua goresan' }, '✕ Hapus semua');
    undoBtn.addEventListener('click', undo);
    clearBtn.addEventListener('click', clearAll);
    tools.appendChild(undoBtn);
    tools.appendChild(clearBtn);
    bar.appendChild(penBtn);
    bar.appendChild(tools);
    penBtn.addEventListener('click', function () { setActive(!active); });
    document.body.appendChild(canvas);
    document.body.appendChild(bar);

    canvas.addEventListener('pointerdown', function (e) {
      if (!active) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      current = {
        color: color.value,
        width: color.marker ? 18 : 3.5,
        points: [[e.clientX + window.scrollX, e.clientY + window.scrollY]]
      };
      requestDraw();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!current) return;
      current.points.push([e.clientX + window.scrollX, e.clientY + window.scrollY]);
      requestDraw();
    });
    function end() {
      if (current) { strokes.push(current); current = null; requestDraw(); }
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    window.addEventListener('scroll', requestDraw, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', function (e) {
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if (e.key === 'p' || e.key === 'P') setActive(!active);
      else if (e.key === 'Escape') setActive(false);
    });
    resize();
  }

  /* ---------- Peta bertitik: klik nomor untuk penjelasan ---------- */
  function initHotspots() {
    document.querySelectorAll('.hotspot-map').forEach(function (map) {
      var pop = el('div', { 'class': 'hotspot-pop', role: 'dialog', hidden: '' });
      map.appendChild(pop);
      var openBtn = null;
      function close() { pop.hidden = true; if (openBtn) openBtn.classList.remove('open'); openBtn = null; }
      map.querySelectorAll('.hotspot').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (openBtn === b) { close(); return; }
          close();
          openBtn = b;
          b.classList.add('open');
          pop.innerHTML = '';
          pop.appendChild(el('strong', {}, b.getAttribute('data-title')));
          var ul = el('ul', {});
          b.getAttribute('data-text').split('|').forEach(function (item) {
            var li = el('li', {});
            item.trim().split('**').forEach(function (part, i) {
              if (!part) return;
              li.appendChild(i % 2 ? el('strong', {}, part) : document.createTextNode(part));
            });
            ul.appendChild(li);
          });
          pop.appendChild(ul);
          var x = parseFloat(b.style.left), y = parseFloat(b.style.top);
          pop.hidden = false;
          pop.style.left = pop.style.right = pop.style.top = pop.style.bottom = '';
          if (x > 55) { pop.style.right = Math.max(0, 100 - x - 6) + '%'; } else { pop.style.left = Math.max(0, x - 6) + '%'; }
          if (y < 55) { pop.style.top = (y + 5) + '%'; } else { pop.style.bottom = (100 - y + 5) + '%'; }
        });
      });
      document.addEventListener('click', function (e) { if (!map.contains(e.target)) close(); });
      pop.addEventListener('click', function (e) { e.stopPropagation(); });
    });
  }

  function init() { initPen(); initHotspots(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
