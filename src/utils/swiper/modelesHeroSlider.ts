/*
 *============================================================================
 * COMPONENT : MODELES HERO SLIDER
 *============================================================================
 */

import 'swiper/css/bundle';

import Swiper from 'swiper/bundle';
import type { SwiperOptions } from 'swiper/types';

/** Configuration for the home hero slider */
const MODELE_HERO_SLIDER_CONFIG: SwiperOptions = {
  direction: 'horizontal',
  loop: true,
  centeredSlides: false,
  slidesPerView: 1,
  spaceBetween: 0,
  speed: 500, // 500ms transition speed for smooth animations
  autoplay: {
    delay: 5000, // 5 seconds between slides
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
    el: '.vehicule_hero_component .swiper-pagination-wrapper',
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
export function initModelesHeroSlider(): void {
  const swipers = document.querySelectorAll('.swiper.is-modeles');

  if (swipers.length === 0) {
    return;
  }

  swipers.forEach((swiperEl) => {
    try {
      const swiper = new Swiper(swiperEl as HTMLElement, MODELE_HERO_SLIDER_CONFIG);

      // Trouve le container parent vehicule_hero_component
      const heroComponent = swiperEl.closest('.vehicule_hero_component');
      if (!heroComponent) return;

      // Trouve l'élément heading à modifier
      const heading = heroComponent.querySelector('.vehicule_hero_content-heading') as HTMLElement;
      if (!heading) return;

      // Fonction pour gérer le changement de slide
      const handleSlideChange = () => {
        const activeSlide = swiper.slides[swiper.activeIndex];

        // Vérifie si la slide active a la classe is-dark
        if (activeSlide?.classList.contains('is-dark')) {
          heading.classList.add('is-dark-mode');
        } else {
          heading.classList.remove('is-dark-mode');
        }
      };

      // Écoute les changements de slide
      swiper.on('slideChange', handleSlideChange);

      // Applique l'état initial
      handleSlideChange();
    } catch (error) {
      console.error('Failed to initialize home hero slider:', error);
    }
  });
}
