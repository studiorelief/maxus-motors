/*
 *============================================================================
 * COMPONENT : SECTION / METIERS
 *============================================================================
 */

import 'swiper/css/bundle';

import Swiper from 'swiper/bundle';

export function initServicesSlide() {
  const swipers = document.querySelectorAll('.swiper.is-services');

  if (swipers.length === 0) {
    return;
  }

  swipers.forEach((swiperEl) => {
    new Swiper(swiperEl as HTMLElement, {
      direction: 'horizontal',
      loop: false,
      centeredSlides: false,
      slidesPerView: 'auto',
      spaceBetween: 2 * 16,
      speed: 500,
      //   autoplay: {
      //     delay: 5000,
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
      pagination: {
        el: '.services_component .swiper-pagination-wrapper',
        bulletClass: 'swiper-bullet',
        bulletActiveClass: 'is-active',
        clickable: true,
      },
      navigation: {
        nextEl: '.services_component .services_slider-arrow',
      },
      touchEventsTarget: 'wrapper',
    });
  });
}
