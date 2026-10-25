/**
 * Scroll-linked parallax.
 *
 * Elements with [data-parallax] get a `--py` custom property (in px) based on
 * where they sit in the viewport; CSS decides what moves. The attribute value
 * is the travel as a fraction of the element's height (default 0.08), and may
 * be negative to drift the other way.
 *
 * Only elements in view are updated, and nothing runs under
 * prefers-reduced-motion.
 */
const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
const visible = new Set<HTMLElement>();
let frame = 0;

function update() {
  frame = 0;
  const vh = window.innerHeight;
  for (const el of visible) {
    const rect = el.getBoundingClientRect();
    // -1 as the element enters at the bottom, 1 as it leaves at the top.
    const progress = Math.max(
      -1,
      Math.min(1, (vh / 2 - (rect.top + rect.height / 2)) / (vh / 2 + rect.height / 2))
    );
    const travel = Number(el.dataset.parallax) || 0.08;
    el.style.setProperty("--py", `${(progress * travel * rect.height).toFixed(1)}px`);
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const el = entry.target as HTMLElement;
    if (entry.isIntersecting) visible.add(el);
    else visible.delete(el);
  }
  schedule();
});

function start() {
  elements.forEach((el) => observer.observe(el));
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function stop() {
  observer.disconnect();
  visible.clear();
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  elements.forEach((el) => el.style.removeProperty("--py"));
}

if (elements.length) {
  if (motion.matches) start();
  motion.addEventListener("change", () => (motion.matches ? start() : stop()));
}
