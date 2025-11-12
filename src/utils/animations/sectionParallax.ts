import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Create parallax animation for elements
 * @param elements - Elements to animate
 * @param fromY - Starting Y position
 * @param toY - Ending Y position
 */
const createParallaxAnimation = (elements: NodeListOf<HTMLElement>, fromY: string, toY: string) => {
  elements.forEach((element) => {
    // Find the parent section element
    const section = element.closest('section');

    if (!section) {
      console.error('No parent section found for parallax element:', element);
      return;
    }

    // Create the parallax animation
    gsap.fromTo(
      element,
      {
        y: fromY,
      },
      {
        y: toY,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom', // When the top of the section hits the bottom of the viewport
          end: 'bottom top', // When the bottom of the section hits the top of the viewport
          scrub: true, // Smooth scrubbing effect
        },
      }
    );
  });
};

/**
 * Initialize parallax animations for elements with gsap="sparallax" or gsap="sparallax-small" attributes
 * - sparallax: Animates from y: -5rem to y: 5rem
 * - sparallax-small: Animates from y: -2.5rem to y: 2.5rem
 * Triggered by the parent section
 */
export const sParallax = () => {
  // Get elements for both variants
  const standardElements = document.querySelectorAll<HTMLElement>('[gsap="sparallax"]');
  const smallElements = document.querySelectorAll<HTMLElement>('[gsap="sparallax-small"]');

  // Only run if at least one element exists
  if (standardElements.length === 0 && smallElements.length === 0) {
    return;
  }

  // Check if mobile device
  const isMobile = window.matchMedia('(max-width: 767px)').matches;

  // Animate standard parallax elements
  // Desktop: -5rem to 5rem, Mobile: -2.5rem to 2.5rem
  if (standardElements.length > 0) {
    const fromY = isMobile ? '-2.5rem' : '-5rem';
    const toY = isMobile ? '2.5rem' : '5rem';
    createParallaxAnimation(standardElements, fromY, toY);
  }

  // Animate small parallax elements
  // Desktop: -4rem to 0rem, Mobile: -2rem to 0rem
  if (smallElements.length > 0) {
    const fromY = isMobile ? '-2rem' : '-4rem';
    const toY = isMobile ? '0rem' : '0rem';
    createParallaxAnimation(smallElements, fromY, toY);
  }
};
