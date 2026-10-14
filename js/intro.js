/* Cinematic zipper intro.
   Drag the puller down (or scroll / swipe / tap it) and the zipper splits open
   to reveal the site. Uses GSAP (loaded from the official CDN in index.html).
   Fails safe: if GSAP is missing the intro is skipped and the site is shown. */
(function () {
  'use strict';

  var root = document.documentElement;
  var intro = document.getElementById('intro');
  if (!intro) return;
  window.__introReady = true; // tells the inline fail-safe in <head> we're alive

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hasGsap = typeof window.gsap !== 'undefined';
  var replayBtn = document.getElementById('intro-replay');

  // Elements are looked up lazily in init() so a skipped intro costs nothing
  var svg, sideL, sideR, panelL, panelR, teeth, puller, pullBtn, avatar, hint, skipBtn;
  var pageParts = document.querySelectorAll('.skip-link, .site-header, #main-content, .site-footer');
  var heroKids = document.querySelectorAll('.hero-content > *, .hero-visual');

  var P0 = 30; // resting puller position (px from top)
  var state = { p: P0, target: P0 };
  var W = 0;
  var H = 0;
  var ready = false;
  var active = false;
  var finishing = false;
  var dragging = false;
  var downOnPuller = false;
  var tickerOn = false;
  var moved = 0;
  var startY = 0;
  var startP = 0;
  var wheelTimer = null;
  var idleTween = null;
  var swingTween = null;

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function setInert(on) {
    for (var i = 0; i < pageParts.length; i++) {
      if (on) pageParts[i].setAttribute('inert', '');
      else pageParts[i].removeAttribute('inert');
    }
  }

  function showReplay() {
    if (replayBtn && hasGsap && !reduce.matches) replayBtn.hidden = false;
  }

  /* ---------- Drawing ---------- */

  function measure() {
    W = intro.clientWidth || window.innerWidth;
    H = intro.clientHeight || window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }

  // Edge of one zipper half: vertical below the puller, fanning out to the top
  function edge(side, p, s) {
    var x0 = W / 2 + side * 4;
    return { x0: x0, xt: x0 + side * s, cx: x0 + side * s * 0.3, cy: p * 0.45 };
  }

  function teethPath(e, p) {
    return 'M' + e.x0 + ',' + H + ' L' + e.x0 + ',' + p + ' Q' + e.cx + ',' + e.cy + ' ' + e.xt + ',0';
  }

  function panelPath(e, p, cornerX) {
    return 'M' + cornerX + ',0 L' + e.xt + ',0 Q' + e.cx + ',' + e.cy + ' ' + e.x0 + ',' + p +
      ' L' + e.x0 + ',' + H + ' L' + cornerX + ',' + H + ' Z';
  }

  function draw() {
    if (!W || !H) return;
    var p = Math.max(0, state.p);
    var s = Math.max(0, (W / 2) * p / (H * 0.82));
    var l = edge(-1, p, s);
    var r = edge(1, p, s);
    var tl = teethPath(l, p);
    var tr = teethPath(r, p);

    panelL.setAttribute('d', panelPath(l, p, 0));
    panelR.setAttribute('d', panelPath(r, p, W));
    teeth[0].setAttribute('d', tl);
    teeth[1].setAttribute('d', tl);
    teeth[2].setAttribute('d', tr);
    teeth[3].setAttribute('d', tr);
    puller.style.transform = 'translate3d(' + W / 2 + 'px,' + p + 'px,0)';
  }

  /* ---------- Idle / entrance animation ---------- */

  function stopIdle() {
    if (idleTween) {
      idleTween.kill();
      idleTween = null;
    }
  }

  function startIdle(delay) {
    stopIdle();
    idleTween = window.gsap.to(state, {
      p: P0 + 16,
      duration: 0.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: delay || 0,
      onUpdate: draw
    });
  }

  function enter() {
    var g = window.gsap;
    g.fromTo(pullBtn, { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', delay: 0.15 });
    g.fromTo(hint, { x: -12, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.55 });
    swingTween = g.fromTo(
      avatar,
      { rotation: -4, transformOrigin: '50% -26px' },
      { rotation: 4, transformOrigin: '50% -26px', duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }
    );
    startIdle(1.4);
  }

  /* ---------- Dragging ---------- */

  function tick() {
    state.p += (state.target - state.p) * 0.3;
    draw();
    if (state.p > H * 0.88) {
      release();
      return;
    }
    if (!dragging && Math.abs(state.target - state.p) < 0.4) stopTicker();
  }

  function startTicker() {
    if (tickerOn) return;
    tickerOn = true;
    window.gsap.ticker.add(tick);
  }

  function stopTicker() {
    if (!tickerOn) return;
    tickerOn = false;
    window.gsap.ticker.remove(tick);
  }

  function springBack() {
    window.gsap.to(state, {
      p: P0,
      target: P0,
      duration: 0.9,
      ease: 'back.out(1.6)',
      onUpdate: draw,
      onComplete: function () {
        if (active && !finishing && !dragging) startIdle(0.6);
      }
    });
  }

  function release() {
    if (!active || finishing) return;
    dragging = false;
    intro.classList.remove('is-dragging');
    stopTicker();
    if (state.p > H * 0.4) open(false);
    else springBack();
  }

  function onDown(e) {
    if (!active || finishing) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest && e.target.closest('.intro-skip')) return;
    dragging = true;
    moved = 0;
    startY = e.clientY;
    startP = state.p;
    downOnPuller = !!(e.target.closest && e.target.closest('.intro-pull-btn'));
    state.target = state.p;
    stopIdle();
    window.gsap.killTweensOf(state);
    try {
      intro.setPointerCapture(e.pointerId);
    } catch (err) { /* not critical */ }
    intro.classList.add('is-dragging');
    startTicker();
  }

  function onMove(e) {
    if (!dragging) return;
    var dy = e.clientY - startY;
    moved = Math.max(moved, Math.abs(dy));
    state.target = clamp(startP + dy, P0, H * 0.95);
  }

  function onUp() {
    if (!dragging) return;
    if (downOnPuller && moved < 6) {
      // A plain tap/click on the puller opens it (easy fallback to dragging)
      dragging = false;
      intro.classList.remove('is-dragging');
      open(false);
      return;
    }
    release();
  }

  function onWheel(e) {
    if (!active || finishing) return;
    e.preventDefault();
    if (dragging) return;
    stopIdle();
    window.gsap.killTweensOf(state);
    if (!tickerOn) state.target = state.p;
    state.target = clamp(state.target + e.deltaY * 0.9, P0, H * 0.95);
    startTicker();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(release, 220);
  }

  /* ---------- Opening / closing ---------- */

  function focusMain() {
    var main = document.getElementById('main-content');
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
    main.addEventListener('blur', function () {
      main.removeAttribute('tabindex');
    }, { once: true });
  }

  function cleanup() {
    var g = window.gsap;
    active = false;
    finishing = false;
    dragging = false;
    stopTicker();
    stopIdle();
    clearTimeout(wheelTimer);
    if (swingTween) {
      swingTween.kill();
      swingTween = null;
    }
    root.classList.remove('intro-active', 'intro-opening', 'intro-fast');
    setInert(false);
    g.set([sideL, sideR, pullBtn, hint, avatar], { clearProps: 'all' });
    g.set(heroKids, { clearProps: 'transform' });
    if (intro.contains(document.activeElement)) focusMain();
    showReplay();
  }

  function open(fast) {
    if (finishing || !active) return;
    var g = window.gsap;
    finishing = true;
    dragging = false;
    stopTicker();
    stopIdle();
    clearTimeout(wheelTimer);
    g.killTweensOf(state);
    if (swingTween) swingTween.kill();
    if (fast) root.classList.add('intro-fast');
    root.classList.add('intro-opening');

    var dur = fast ? 0.45 : 1.15;
    var tl = g.timeline({ onComplete: cleanup });
    tl.to(state, { p: H * 1.04, duration: dur, ease: 'power2.in', onUpdate: draw }, 0);
    tl.to(hint, { opacity: 0, duration: 0.25 }, 0);
    tl.to(
      heroKids,
      { y: 0, duration: fast ? 0.4 : 0.9, stagger: fast ? 0 : 0.08, ease: 'power3.out' },
      dur * 0.4
    );
    tl.to(sideL, { x: -W * 0.5, opacity: 0, duration: fast ? 0.3 : 0.6, ease: 'power2.in' }, dur - 0.15);
    tl.to(sideR, { x: W * 0.5, opacity: 0, duration: fast ? 0.3 : 0.6, ease: 'power2.in' }, dur - 0.15);
  }

  function instantFinish() {
    if (!active) return;
    window.gsap.killTweensOf([state, sideL, sideR, pullBtn, hint, avatar, heroKids]);
    cleanup();
    if (replayBtn) replayBtn.hidden = true;
  }

  /* ---------- Setup ---------- */

  function init() {
    if (ready) return;
    ready = true;
    svg = intro.querySelector('.intro-svg');
    sideL = document.getElementById('intro-side-l');
    sideR = document.getElementById('intro-side-r');
    panelL = document.getElementById('intro-panel-l');
    panelR = document.getElementById('intro-panel-r');
    teeth = [
      document.getElementById('intro-teeth-back-l'),
      document.getElementById('intro-teeth-front-l'),
      document.getElementById('intro-teeth-back-r'),
      document.getElementById('intro-teeth-front-r')
    ];
    puller = document.getElementById('intro-puller');
    pullBtn = document.getElementById('intro-pull-btn');
    avatar = intro.querySelector('.zip-avatar');
    hint = intro.querySelector('.intro-hint');
    skipBtn = intro.querySelector('.intro-skip');

    intro.addEventListener('pointerdown', onDown);
    intro.addEventListener('pointermove', onMove);
    intro.addEventListener('pointerup', onUp);
    intro.addEventListener('pointercancel', release);
    intro.addEventListener('wheel', onWheel, { passive: false });

    // Keyboard: Enter / Space (click with detail 0) or ArrowDown opens it
    pullBtn.addEventListener('click', function (e) {
      if (e.detail === 0) open(false);
    });
    pullBtn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        open(false);
      }
    });
    skipBtn.addEventListener('click', function () {
      open(true);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && active) open(true);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (!active) return;
        measure();
        draw();
      }).observe(intro);
    } else {
      window.addEventListener('resize', function () {
        if (!active) return;
        measure();
        draw();
      });
    }

    if (reduce.addEventListener) {
      reduce.addEventListener('change', function () {
        if (reduce.matches) instantFinish();
      });
    }
  }

  function play() {
    init();
    var g = window.gsap;
    g.killTweensOf([state, sideL, sideR, pullBtn, hint, avatar]);
    g.set([sideL, sideR, pullBtn, hint, avatar], { clearProps: 'all' });
    g.set(heroKids, { y: 28 }); // hero waits slightly low (hidden by the blur), then rises on open
    state.p = P0;
    state.target = P0;
    finishing = false;
    dragging = false;
    active = true;
    root.classList.remove('intro-opening', 'intro-fast');
    root.classList.add('intro-active');
    setInert(true);
    measure();
    draw();
    enter();
  }

  function replay() {
    if (reduce.matches || active) return;
    replayBtn.hidden = true;
    // Jump to the top instantly (the site uses smooth scrolling by default)
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = '';
    play();
  }

  if (replayBtn) replayBtn.addEventListener('click', replay);

  if (!hasGsap) {
    // GSAP didn't load: never block the site
    root.classList.remove('intro-active');
    if (replayBtn) replayBtn.hidden = true;
    return;
  }

  if (reduce.matches) {
    root.classList.remove('intro-active');
    return;
  }

  if (root.classList.contains('intro-active')) play();
  else showReplay(); // intro skipped for a deep link (#about etc.), replay still available
})();
