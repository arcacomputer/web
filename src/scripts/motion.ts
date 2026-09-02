/**
 * Motion layer shared by the Arca Computer pages.
 *
 * Everything here is progressive enhancement: each page is fully readable with
 * this script absent, and every hidden-until-revealed rule in motion.css is
 * scoped to `html.js` + `prefers-reduced-motion: no-preference`.
 */

const REVEAL_SELECTOR = '[data-reveal], [data-reveal-line], [data-reveal-stagger] > *';
const HIGHLIGHT_SELECTOR = '.glow';
const HEADER_SELECTOR = '.masthead, .deck-header';
const SECTION_LINK_SELECTOR = '.masthead nav a[href^="#"], .rail a[href^="#"]';
const STAGGER_STEP_MS = 70;
const REVEAL_MS = 800;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

function setupReveal(): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  if (targets.length === 0) return;

  const finish = (el: HTMLElement, index: number) => {
    el.style.setProperty('--i', String(index));
    el.classList.add('is-in');
    // Hand the element back to its own transitions once the reveal has played.
    window.setTimeout(
      () => el.classList.add('is-done'),
      reduceMotion.matches ? 0 : REVEAL_MS + index * STAGGER_STEP_MS + 120,
    );
  };

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => finish(el, 0));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      let batch = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        finish(entry.target as HTMLElement, Math.min(batch, 7));
        batch += 1;
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => observer.observe(el));
}

/** Condensed header, scroll-progress hairline, and the active section link. */
function setupHeader(): void {
  const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(SECTION_LINK_SELECTOR));
  if (!header && links.length === 0) return;

  const sections = links
    .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
    .filter((entry): entry is { link: HTMLAnchorElement; section: HTMLElement } => entry.section !== null);

  let scheduled = false;
  const update = () => {
    scheduled = false;
    const y = window.scrollY;
    if (header) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle('is-condensed', y > 24);
      header.style.setProperty('--progress', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    }

    // The active section is the last one whose top has passed 40% of the viewport.
    const probe = window.innerHeight * 0.4;
    let active: HTMLAnchorElement | null = null;
    for (const { link, section } of sections) {
      if (section.getBoundingClientRect().top <= probe) active = link;
    }
    for (const link of links) {
      if (link === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    },
    { passive: true },
  );
  window.addEventListener('resize', update, { passive: true });
  update();
}

function setupPointerHighlight(): void {
  if (!finePointer.matches) return;

  document.addEventListener(
    'pointermove',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest<HTMLElement>(HIGHLIGHT_SELECTOR);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${(event.clientX - rect.left).toFixed(1)}px`);
      card.style.setProperty('--my', `${(event.clientY - rect.top).toFixed(1)}px`);
    },
    { passive: true },
  );
}

function setupMagneticButtons(): void {
  if (!finePointer.matches || reduceMotion.matches) return;

  for (const button of document.querySelectorAll<HTMLElement>('.button')) {
    button.classList.add('is-magnetic');

    button.addEventListener(
      'pointermove',
      (event) => {
        const rect = button.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const x = Math.max(-6, Math.min(6, dx * 0.16));
        const y = Math.max(-5, Math.min(5, dy * 0.28));
        button.classList.remove('is-returning');
        button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      },
      { passive: true },
    );

    button.addEventListener('pointerleave', () => {
      button.classList.add('is-returning');
      button.style.transform = '';
    });

    button.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'transform') button.classList.remove('is-returning');
    });
  }
}

function setupCounters(): void {
  const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (counters.length === 0 || reduceMotion.matches || !('IntersectionObserver' in window)) return;

  const format = new Intl.NumberFormat('en-US');

  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const suffix = el.dataset.suffix ?? '';
    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = format.format(Math.round(target * eased)) + suffix;
      if (progress < 1) window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        run(entry.target as HTMLElement);
      }
    },
    { threshold: 0.4 },
  );

  counters.forEach((el) => observer.observe(el));
}

/** Measures the on-screen length of a non-scaling-stroke path so dash offsets match. */
function screenLength(path: SVGPathElement): number {
  const userLength = path.getTotalLength();
  const matrix = path.getScreenCTM();
  if (!matrix || userLength === 0) return userLength;
  const samples = 120;
  let total = 0;
  let previous = path.getPointAtLength(0).matrixTransform(matrix);
  for (let i = 1; i <= samples; i += 1) {
    const point = path.getPointAtLength((userLength * i) / samples).matrixTransform(matrix);
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}

/** Every [data-draw] container draws its SVG paths on when it scrolls into view. */
function setupDrawings(): void {
  const containers = Array.from(document.querySelectorAll<HTMLElement>('[data-draw]'));
  if (containers.length === 0) return;

  for (const container of containers) {
    const paths = Array.from(container.querySelectorAll<SVGPathElement>('path'));
    const canDraw =
      paths.length > 0 &&
      !reduceMotion.matches &&
      'IntersectionObserver' in window &&
      typeof paths[0].getTotalLength === 'function';

    if (!canDraw) {
      container.classList.add('is-drawn');
      continue;
    }

    const prime = () => {
      for (const path of paths) {
        const length = Math.ceil(screenLength(path)) + 2;
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
      }
      container.classList.add('is-primed');
    };
    prime();

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        // Re-measure right before drawing in case the layout changed since priming.
        prime();
        window.requestAnimationFrame(() => {
          container.classList.add('is-drawn');
          for (const path of paths) path.style.strokeDashoffset = '0';
        });
        window.setTimeout(() => {
          for (const path of paths) {
            path.style.strokeDasharray = '';
            path.style.strokeDashoffset = '';
          }
        }, 3600);
      },
      { threshold: 0.35 },
    );
    observer.observe(container);
  }
}

export function initMotion(): void {
  setupReveal();
  setupHeader();
  setupPointerHighlight();
  setupMagneticButtons();
  setupCounters();
  setupDrawings();
}
