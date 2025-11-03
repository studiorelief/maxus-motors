/*
 *============================================================================
 * COMPONENT : MODELES HERO SLIDER
 *============================================================================
 */

import 'swiper/css/bundle';

import Swiper from 'swiper/bundle';
import type { SwiperOptions } from 'swiper/types';

/** Configuration for the home hero slider */
const MODELE_INNER_HERO_SLIDER_CONFIG: SwiperOptions = {
  direction: 'horizontal',
  loop: true,
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
  navigation: {
    nextEl: '.vehicules_fonctionnalites_slider-left .button_icon_wrap',
    prevEl: '.vehicules_fonctionnalites_slider-right .button_icon_wrap',
  },
  pagination: {
    el: '.vehicule_fonctionnalites_pagination-position .swiper-pagination-wrapper',
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
export function initModelesInnerSlider(): void {
  const swipers = document.querySelectorAll('.swiper.is-modeles-inner');

  if (swipers.length === 0) {
    return;
  }

  swipers.forEach((swiperEl) => {
    try {
      new Swiper(swiperEl as HTMLElement, MODELE_INNER_HERO_SLIDER_CONFIG);
    } catch (error) {
      console.error('Failed to initialize home hero slider:', error);
    }
  });
}
