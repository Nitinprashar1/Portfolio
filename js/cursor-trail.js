/* Neon cursor: a smooth green / purple / blue ribbon that trails the mouse,
   a ring that eases after it (and swells over links, buttons and cards),
   and a ripple on click. Plain canvas, no libraries.
   Runs ONLY while the zipper intro is showing (html.intro-active); it switches
   off when the intro ends and comes back if the intro is replayed.
   Mouse/pen only, off for reduced motion. The native cursor is left alone. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var canvas = document.getElementById('neon-trail');
  if (!canvas || reduce.matches || !finePointer.matches) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var root = document.documentElement;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var POINTS = 22;
  var INTERACTIVE = 'a, button, [role="button"], .glass-card, .skill-pill, .intro-pull-btn';
  var PALETTE = [
    [57, 255, 136], // neon green
    [168, 85, 247], // neon purple
    [0, 212, 255]   // neon blue
  ];

  var width = 0;
  var height = 0;
  var enabled = true;
  var running = false;
  var seen = false;
  var hovering = false;
  var pressed = false;
  var lastTime = 0;
  var mouse = { x: 0, y: 0 };
  var pts = [];
  var ring = { x: 0, y: 0, r: 14, a: 0, ta: 0 };
  var ripples = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * DPR);
    canvas.height = Math.round(height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function rgb(t, a) {
    t = ((t % 1) + 1) % 1;
    var n = PALETTE.length;
    var x = t * n;
    var i = Math.floor(x);
    var f = x - i;
    var c1 = PALETTE[i % n];
    var c2 = PALETTE[(i + 1) % n];
    var r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
    var g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
    var b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // Frame-rate independent easing factor
  function ease(f, dt) {
    return 1 - Math.pow(1 - f, dt / 16.67);
  }

  function inIntro() {
    return root.classList.contains('intro-active');
  }

  function onMove(e) {
    if (!enabled || !inIntro() || e.pointerType === 'touch') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!seen) {
      seen = true;
      pts = [];
      for (var i = 0; i < POINTS; i++) pts.push({ x: mouse.x, y: mouse.y });
      ring.x = mouse.x;
      ring.y = mouse.y;
    }
    var t = e.target;
    hovering = !!(t && t.closest && t.closest(INTERACTIVE));
    ring.ta = 1;
    start();
  }

  function onDown(e) {
    if (!enabled || !inIntro() || e.pointerType === 'touch' || !seen) return;
    pressed = true;
    ripples.push({ x: e.clientX, y: e.clientY, age: 0, hue: Math.random() });
    start();
  }

  function onUp() {
    pressed = false;
    start();
  }

  function drawRibbon(now) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var shift = now * 0.00012;
    for (var i = POINTS - 1; i > 0; i--) {
      var t = 1 - i / POINTS; // 1 at the head, 0 at the tail
      var w = 1 + t * 9;
      var col = i / POINTS * 0.85 + shift;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
      ctx.strokeStyle = rgb(col, t * 0.16); // soft glow pass
      ctx.lineWidth = w * 2.6;
      ctx.stroke();
      ctx.strokeStyle = rgb(col, t * 0.85); // bright core pass
      ctx.lineWidth = w;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRing() {
    if (ring.a < 0.01) return;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    if (hovering) {
      ctx.fillStyle = 'rgba(0,212,255,' + ring.a * 0.1 + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,212,255,' + ring.a * 0.85 + ')';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,' + ring.a * 0.5 + ')';
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawRipples(dt, now) {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var rp = ripples[i];
      rp.age += dt;
      var t = rp.age / 600;
      if (t >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 8 + t * 46, 0, Math.PI * 2);
      ctx.strokeStyle = rgb(rp.hue + now * 0.0001, (1 - t) * 0.8);
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.stroke();
    }
  }

  function frame(now) {
    if (!inIntro()) {
      endCursor();
      return;
    }
    var dt = Math.min(50, now - lastTime || 16);
    lastTime = now;

    // Ribbon: head chases the mouse, each point chases the one ahead of it
    pts[0].x += (mouse.x - pts[0].x) * ease(0.5, dt);
    pts[0].y += (mouse.y - pts[0].y) * ease(0.5, dt);
    for (var i = 1; i < POINTS; i++) {
      pts[i].x += (pts[i - 1].x - pts[i].x) * ease(0.38, dt);
      pts[i].y += (pts[i - 1].y - pts[i].y) * ease(0.38, dt);
    }

    // Ring: eases after the mouse, swells over interactive things, shrinks on press
    var targetR = pressed ? 9 : hovering ? 26 : 14;
    ring.x += (mouse.x - ring.x) * ease(0.2, dt);
    ring.y += (mouse.y - ring.y) * ease(0.2, dt);
    ring.r += (targetR - ring.r) * ease(0.2, dt);
    ring.a += (ring.ta - ring.a) * ease(0.15, dt);

    ctx.clearRect(0, 0, width, height);
    drawRibbon(now);
    drawRing();
    drawRipples(dt, now);

    var tail = pts[POINTS - 1];
    var ribbonSettled = Math.abs(tail.x - mouse.x) + Math.abs(tail.y - mouse.y) < 0.6;
    var ringSettled =
      Math.abs(ring.x - mouse.x) + Math.abs(ring.y - mouse.y) < 0.4 &&
      Math.abs(ring.r - targetR) < 0.2 &&
      Math.abs(ring.a - ring.ta) < 0.01;

    if (ribbonSettled && ringSettled && !ripples.length) {
      running = false; // fully idle: no work while the mouse is still
    } else {
      window.requestAnimationFrame(frame);
    }
  }

  // Intro is over: wipe the canvas and forget the pointer so a replay starts fresh
  function endCursor() {
    running = false;
    seen = false;
    pressed = false;
    hovering = false;
    ripples.length = 0;
    ring.a = 0;
    ring.ta = 0;
    ctx.clearRect(0, 0, width, height);
  }

  function start() {
    if (running || !seen) return;
    running = true;
    lastTime = performance.now();
    window.requestAnimationFrame(frame);
  }

  function disable() {
    enabled = false;
    ctx.clearRect(0, 0, width, height);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('mouseleave', function () {
    ring.ta = 0;
    start();
  });

  // Clear the last frame the moment the intro class is removed
  if ('MutationObserver' in window) {
    new MutationObserver(function () {
      if (!inIntro()) endCursor();
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  if (reduce.addEventListener) {
    reduce.addEventListener('change', function () {
      if (reduce.matches) disable();
    });
  }
})();
