import './index.css';

import { comparateurLogic } from '$utils/comparateur/comparateur';
import { loadAttributesScripts } from '$utils/global/loadScript';
import { initMarker } from '$utils/global/marker';
import { initMap } from '$utils/map/map';
import { initAnchorPosition } from '$utils/modeles/anchorPosition';
import { initSideNav, navbarScrollBehavior } from '$utils/navbar/navbar';
import { initHomeHeroSlider } from '$utils/swiper/homeHeroSlider';
import { initModelesHeroSlider } from '$utils/swiper/modelesHeroSlider';
import { initModelesInnerSlider } from '$utils/swiper/modelesInnerHeroSlider';
import { initServicesSlide } from '$utils/swiper/servicesSlider';

import { popupSales } from './utils/component/popup';
import { initConcessionCta } from './utils/map/concessionCta';
import { initOffresSlider } from './utils/swiper/offresSlider';

window.Webflow ||= [];
window.Webflow.push(() => {
  /* script */
  loadAttributesScripts();

  /* Recette */
  initMarker();

  /* Navbar */
  initSideNav();
  navbarScrollBehavior();

  /* Popup Sales */
  popupSales();

  /* Map Concessions */
  initMap();

  /* CTA Concession cross-page */
  initConcessionCta();

  /* Comparateur */
  comparateurLogic();

  /* Sliders */
  initHomeHeroSlider();
  initServicesSlide();
  initOffresSlider();
  initModelesHeroSlider();
  initModelesInnerSlider();

  /* Modèles: anchor fixed after 200vh */
  initAnchorPosition();
});
