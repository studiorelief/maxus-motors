/*
 *============================================================================
 * COMPONENT : MODELES INNER SLIDER
 *============================================================================
 */

import 'swiper/css/bundle';

import Swiper from 'swiper/bundle';
import type { SwiperOptions } from 'swiper/types';

/** Base configuration for the modeles inner slider (will be customized per instance) */

const getModeleInnerSliderConfig = (swiperEl: HTMLElement): SwiperOptions => {
  // Find navigation and pagination elements relative to this specific swiper
  // Cherche dans la section parente la plus proche pour isoler chaque slider
  const section =
    swiperEl.closest('section') ||
    swiperEl.closest('.vehicules_fonctionnalites_wrapper') ||
    swiperEl.parentElement;

  const prevButton = section?.querySelector(
    '.vehicules_fonctionnalites_slider-left .button_icon_wrap'
  );
  const nextButton = section?.querySelector(
    '.vehicules_fonctionnalites_slider-right .button_icon_wrap'
  );
  const paginationWrapper = section?.querySelector(
    '.vehicule_fonctionnalites_pagination-position .swiper-pagination-wrapper'
  );

  return {
    direction: 'horizontal',
    loop: false,
    centeredSlides: false,
    slidesPerView: 1,
    spaceBetween: 0,
    speed: 500, // 500ms transition speed for smooth animations
    //   autoplay: {
    //     delay: 5000, // 5 seconds between slides
    //     disableOnInteraction: false,
    //   },
    grabCursor: true,
    allowTouchMove: true,
    keyboard: true,
    mousewheel: {
      forceToAxis: true,
      sensitivity: 1,
      releaseOnEdges: true,
      eventsTarget: 'container',
    },
    navigation:
      prevButton && nextButton
        ? {
            prevEl: prevButton as HTMLElement,
            nextEl: nextButton as HTMLElement,
          }
        : false,
    pagination: paginationWrapper
      ? {
          el: paginationWrapper as HTMLElement,
          bulletClass: 'swiper-bullet',
          bulletActiveClass: 'is-active',
          clickable: true,
        }
      : false,
    touchEventsTarget: 'wrapper',
  };
};

/**
 * Initializes Swiper sliders for home hero sections
 * Finds all elements with class 'swiper.is-home-hero' and initializes them
 * with predefined configuration including autoplay, pagination, and navigation
 *
 * @returns {void}
 */
export function initModelesInnerSlider(): void {
  const swipers = document.querySelectorAll('.swiper.is-modeles-inner');

  if (swipers.length === 0) {
    return;
  }

  swipers.forEach((swiperEl) => {
    try {
      const config = getModeleInnerSliderConfig(swiperEl as HTMLElement);
      const swiper = new Swiper(swiperEl as HTMLElement, config);

      // Trouve la section parente pour les éléments à modifier
      const section =
        swiperEl.closest('section') ||
        swiperEl.closest('.vehicules_fonctionnalites_wrapper') ||
        swiperEl.parentElement;
      if (!section) return;

      // Fonction pour gérer le changement de slide (spécifique à ce swiper)
      const handleSlideChange = () => {
        const activeSlide = swiper.slides[swiper.activeIndex];

        // Exemple : gérer les classes des slides actives
        // Vous pouvez personnaliser cette logique selon vos besoins
        if (activeSlide) {
          // Logique personnalisée pour chaque changement de slide
          // Ex: activeSlide.classList.add('custom-class');
        }
      };

      // Écoute les changements de slide
      swiper.on('slideChange', handleSlideChange);

      // Applique l'état initial
      handleSlideChange();
    } catch (error) {
      console.error('Failed to initialize modeles inner slider:', error);
    }
  });
}
