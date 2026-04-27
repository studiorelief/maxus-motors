/*
 *============================================================================
 * COMPONENT : HOME HERO SLIDER
 *============================================================================
 */

import 'swiper/css/bundle';

import Swiper from 'swiper/bundle';
import type { SwiperOptions } from 'swiper/types';

/** Configuration for the home hero slider */
const HOME_HERO_SLIDER_CONFIG: SwiperOptions = {
  direction: 'horizontal',
  loop: true,
  centeredSlides: false,
  slidesPerView: 1,
  spaceBetween: 0,
  speed: 500, // 500ms transition speed for smooth animations
  autoplay: {
    delay: 15000, // 15 seconds between slides
    disableOnInteraction: false,
  },
  grabCursor: true,
  allowTouchMove: true,
  keyboard: true,
  mousewheel: {
    forceToAxis: true,
    sensitivity: 1,
    releaseOnEdges: true,
    eventsTarget: 'container',
  },
  pagination: {
    el: '.home_hero_component .swiper-pagination-wrapper',
    bulletClass: 'swiper-bullet',
    bulletActiveClass: 'is-active',
    clickable: true,
  },
  touchEventsTarget: 'wrapper',
};

/**
 * Initializes Swiper sliders for home hero sections
 * Finds all elements with class 'swiper.is-home-hero' and initializes them
 * with predefined configuration including autoplay, pagination, and navigation
 *
 * @returns {void}
 */
export function initHomeHeroSlider(): void {
  const swipers = document.querySelectorAll('.swiper.is-home-hero');

  if (swipers.length === 0) {
    return;
  }

  swipers.forEach((swiperEl) => {
    try {
      // Strip src from all slide videos before Swiper init to prevent bulk download
      const videos = swiperEl.querySelectorAll<HTMLVideoElement>('video.video-component');
      for (const video of videos) {
        const src = video.getAttribute('src');
        if (src) {
          video.setAttribute('data-src', src);
          video.removeAttribute('src');
          video.load();
        }
      }

      const swiper = new Swiper(swiperEl as HTMLElement, HOME_HERO_SLIDER_CONFIG);

      // Load & play the active slide video on each transition
      const handleSlideChange = () => {
        const { slides } = swiper;
        for (let i = 0; i < slides.length; i++) {
          const video = slides[i].querySelector<HTMLVideoElement>('video.video-component');
          if (!video) continue;

          if (i === swiper.activeIndex) {
            const dataSrc = video.getAttribute('data-src');
            if (dataSrc && video.getAttribute('src') !== dataSrc) {
              video.src = dataSrc;
            }
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      };

      // Fire once on init + on every slide change
      handleSlideChange();
      swiper.on('slideChangeTransitionStart', handleSlideChange);
    } catch (error) {
      console.error('Failed to initialize home hero slider:', error);
    }
  });
}
