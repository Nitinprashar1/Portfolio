/* Interactive effects: scroll reveals, counting stats, card tilt + spotlight,
   magnetic icon buttons and a two-row skills marquee.
   Plain JavaScript, no libraries. Skipped entirely for reduced motion. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var SKILLS_MARQUEE = true; // set to false to keep the original wrapped skill pills

  var REVEAL = [
    '.section-heading',
    '.about-card',
    '.service-card',
    '.portfolio-card',
    '.stat-card',
    '.timeline-card',
    '.contact-info',
    '.contact-cta',
    '.skills-grid',
    '.footer-shell > div'
  ].join(',');

  var statNodes = [];

  function qsa(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /* ---------- Counting stats ---------- */
  function prepareStats() {
    qsa('.stat-card strong').forEach(function (el) {
      var m = /^(\d+)(.*)$/.exec(el.textContent.trim());
      if (!m) return;
      el.setAttribute('data-final', el.textContent.trim());
      el._count = { to: parseInt(m[1], 10), suffix: m[2] };
      el.textContent = '0' + m[2];
      statNodes.push(el);
    });
  }

  function countUp(el) {
    var c = el._count;
    if (!c) return;
    var start = performance.now();
    var dur = 1400;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(c.to * eased) + c.suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = el.getAttribute('data-final');
    })(start);
  }

  /* ---------- Scroll reveal ---------- */
  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      statNodes.forEach(function (el) { el.textContent = el.getAttribute('data-final'); });
      return;
    }
    var items = qsa(REVEAL).filter(function (el) { return !el.closest('.hero'); });
    items.forEach(function (el) { el.classList.add('fx-hide'); });

    var io = new IntersectionObserver(
      function (entries) {
        var n = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);
          var fromLeft = el.classList.contains('timeline-card');
          el.classList.remove('fx-hide');
          el.animate(
            [
              { opacity: 0, transform: fromLeft ? 'translateX(-28px)' : 'translateY(28px)' },
              { opacity: 1, transform: 'none' }
            ],
            { duration: 700, delay: Math.min(n, 5) * 90, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }
          );
          n++;
          var strong = el.querySelector && el.querySelector('strong');
          if (strong && strong._count) setTimeout(function () { countUp(strong); }, Math.min(n, 5) * 90);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Pause neon borders on cards that are off screen ---------- */
  function setupBorderPause() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('fx-offscreen', !entry.isIntersecting);
      });
    });
    qsa('.glass-card').forEach(function (el) { io.observe(el); });
  }

  /* ---------- Card tilt + spotlight ---------- */
  function setupTilt() {
    root.classList.add('fx-tilt');
    qsa('.about-card, .service-card, .portfolio-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--fx-ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
        card.style.setProperty('--fx-rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--fx-mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--fx-my', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--fx-rx', '0deg');
        card.style.setProperty('--fx-ry', '0deg');
      });
    });
  }

  /* ---------- Hero portrait parallax ---------- */
  function setupHeroParallax() {
    var hero = document.querySelector('.hero');
    var vis = document.querySelector('.hero-visual');
    if (!hero || !vis) return;
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = vis.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      var y = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      vis.style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3));
      vis.style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3));
    });
    hero.addEventListener('pointerleave', function () {
      vis.style.setProperty('--px', '0');
      vis.style.setProperty('--py', '0');
    });
  }

  /* ---------- Magnetic icon buttons ---------- */
  function setupMagnetic() {
    var items = qsa('.social-row a, .footer-social a, .intro-replay');
    var RADIUS = 90;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (!r.width) return;
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        if (Math.sqrt(dx * dx + dy * dy) < RADIUS) {
          var mx = Math.max(-10, Math.min(10, dx * 0.35));
          var my = Math.max(-10, Math.min(10, dy * 0.35));
          el.style.translate = mx.toFixed(1) + 'px ' + my.toFixed(1) + 'px';
        } else if (el.style.translate) {
          el.style.translate = '';
        }
      });
    }, { passive: true });
  }

  /* ---------- Skills marquee ---------- */
  var marquee = null;

  function layoutMarquee() {
    if (!marquee) return;
    var vw = marquee.grid.clientWidth || window.innerWidth;
    marquee.tracks.forEach(function (t, idx) {
      qsa('.fx-clone', t.el).forEach(function (c) { c.remove(); });
      var setW = t.set.offsetWidth;
      if (!setW) return;
      var copies = Math.ceil(vw / setW) + 1;
      for (var i = 0; i < copies; i++) {
        var clone = t.set.cloneNode(true);
        clone.classList.add('fx-clone');
        clone.setAttribute('aria-hidden', 'true');
        t.el.appendChild(clone);
      }
      t.el.style.setProperty('--fx-shift', setW + 'px');
      t.el.style.setProperty('--fx-dur', Math.max(20, setW / 55) + 's');
      t.el.style.animationDelay = (idx ? '-' + setW / 110 : '0') + 's';
    });
  }

  function setupMarquee() {
    var grid = document.querySelector('.skills-grid');
    if (!grid) return;
    var pills = qsa('.skill-pill', grid);
    if (pills.length < 4) return;

    var half = Math.ceil(pills.length / 2);
    var tracks = [pills.slice(0, half), pills.slice(half)].map(function (group, idx) {
      var track = document.createElement('div');
      track.className = 'fx-track' + (idx ? ' fx-rev' : '');
      var set = document.createElement('div');
      set.className = 'fx-set';
      group.forEach(function (p) { set.appendChild(p); });
      track.appendChild(set);
      grid.appendChild(track);
      return { el: track, set: set };
    });

    marquee = { grid: grid, tracks: tracks };
    root.classList.add('fx-marquee');
    layoutMarquee();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutMarquee);
    window.addEventListener('load', layoutMarquee);

    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(layoutMarquee, 150);
    });
  }

  /* ---------- UX: scroll progress bar ---------- */
  function setupProgress() {
    var bar = document.createElement('div');
    bar.className = 'fx-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var max = root.scrollHeight - root.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, root.scrollTop / max) : 0) + ')';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- UX: highlight the nav link of the section on screen ---------- */
  function setupNavActive() {
    if (!('IntersectionObserver' in window)) return;
    var links = qsa('.site-nav a[href^="#"]');
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = id && document.getElementById(id);
      if (sec) map[id] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.remove('is-active');
          a.removeAttribute('aria-current');
        });
        var a = map[entry.target.id];
        if (a) {
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'location');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ---------- Go (and never leave content hidden if something throws) ---------- */
  try {
    setupProgress();
    setupNavActive();
    if (!reduce) {
      prepareStats();
      setupReveal();
      setupBorderPause();
      if (fine) {
        setupTilt();
        setupMagnetic();
        setupHeroParallax();
      }
      if (SKILLS_MARQUEE) setupMarquee();
    }
  } catch (err) {
    qsa('.fx-hide').forEach(function (el) { el.classList.remove('fx-hide'); });
    statNodes.forEach(function (el) { el.textContent = el.getAttribute('data-final'); });
    root.classList.remove('fx-tilt', 'fx-marquee');
    if (window.console) console.warn('effects.js disabled:', err);
  }
})();
