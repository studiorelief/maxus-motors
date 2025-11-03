import { gsap } from 'gsap';

function applyFixedStyles(el: HTMLElement): void {
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.right = '0';
  el.style.bottom = '0';
  el.style.zIndex = '10';
  el.style.transform = 'translateY(100%)';
  el.style.willChange = 'transform';
}

function clearFixedStyles(el: HTMLElement): void {
  el.style.position = '';
  el.style.left = '';
  el.style.right = '';
  el.style.bottom = '';
  el.style.zIndex = '';
  el.style.transform = '';
  el.style.willChange = '';
  el.style.display = '';
}

function animateShow(el: HTMLElement): void {
  gsap.killTweensOf(el);
  gsap.fromTo(el, { y: '100%' }, { y: '0%', duration: 0.3, ease: 'power2.out' });
}

function animateHide(el: HTMLElement, onDone: () => void): void {
  gsap.killTweensOf(el);
  gsap.to(el, { y: '100%', duration: 0.25, ease: 'power2.in', onComplete: onDone });
}

export function initAnchorPosition(): void {
  const anchorEl = document.querySelector<HTMLElement>('.section_vehicule_anchor');
  if (!anchorEl) return;
  const wrapperEl = anchorEl.closest<HTMLElement>('.vehicule_anchor_wrapper');

  let isFixed = false;

  const setWrapperReserveHeight = () => {
    if (!wrapperEl) return;
    // Measure before fixing to avoid measuring transformed element
    const height = anchorEl.offsetHeight;
    if (height > 0) {
      wrapperEl.style.height = `${height}px`;
      wrapperEl.style.minHeight = `${height}px`;
    }
  };

  const clearWrapperReserveHeight = () => {
    if (!wrapperEl) return;
    wrapperEl.style.height = '';
    wrapperEl.style.minHeight = '';
  };

  const fixToBottom = () => {
    if (isFixed) return;
    setWrapperReserveHeight();
    applyFixedStyles(anchorEl);
    animateShow(anchorEl);
    isFixed = true;
  };

  const unfixToFlow = () => {
    if (!isFixed) return;
    animateHide(anchorEl, () => {
      clearFixedStyles(anchorEl);
      clearWrapperReserveHeight();
    });
    isFixed = false;
  };

  const getThresholdPx = (): number => window.innerHeight * 1 + 6 * 16;

  let rafId = 0;
  const evaluate = () => {
    rafId = 0;
    const threshold = getThresholdPx();
    const scrolled = window.scrollY || window.pageYOffset;
    if (scrolled > threshold) fixToBottom();
    else unfixToFlow();
  };

  const onScroll = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(evaluate);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (isFixed) setWrapperReserveHeight();
    onScroll();
  });
  evaluate();
}
