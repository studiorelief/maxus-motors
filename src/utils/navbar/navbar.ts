// ============================================================================
// CONSTANTS
// ============================================================================
const SCROLL_THRESHOLD = 5; // Minimum scroll distance to trigger navbar changes
const SCROLL_HIDE_OFFSET = 50; // Minimum scroll position to start hiding navbar
const NAVBAR_SHOW_DELAY = 3000; // Auto-show delay after inactivity (3 seconds)
const VIEWPORT_HEIGHT_THRESHOLD = window.innerHeight - 104; // 100vh threshold (6.5rem = 104px)

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
interface NavbarState {
  lastScrollY: number;
  ticking: boolean;
  scrollTimeout: number | null;
  scrollListener: (() => void) | null;
  isNavLeftHidden: boolean;
  isBackgroundLayerVisible: boolean;
}

const navbarState: NavbarState = {
  lastScrollY: 0,
  ticking: false,
  scrollTimeout: null,
  scrollListener: null,
  isNavLeftHidden: false,
  isBackgroundLayerVisible: false,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function clearScrollTimeout(): void {
  if (navbarState.scrollTimeout) {
    clearTimeout(navbarState.scrollTimeout);
    navbarState.scrollTimeout = null;
  }
}

// ============================================================================
// SCROLL BEHAVIOR
// ============================================================================
/**
 * Gère le comportement de la navbar selon le scroll :
 * - nav_left disparaît/réapparaît selon la direction de scroll
 * - nav_container_background-layer apparaît après 100vh de scroll
 * - Auto-affichage après 3s d'inactivité (sauf dans les 100vh du haut)
 */
export function navbarScrollBehavior(): void {
  const navLeft = document.querySelector('.nav_left') as HTMLElement;
  const navBrand = document.querySelector('.nav_brand') as HTMLElement;
  const navBackgroundLayer = document.querySelector(
    '.nav_container_background-layer'
  ) as HTMLElement;

  if (!navLeft || !navBackgroundLayer || !navBrand) {
    return;
  }

  // Initialize navbar styles
  navLeft.style.transition = 'transform 0.3s ease-in-out';
  navLeft.style.transform = 'translateY(0)';
  navLeft.style.zIndex = '100'; // Ensure nav_left is above background layer

  navBrand.style.transition = 'transform 0.3s ease-in-out';
  navBrand.style.transform = 'translateY(0)';
  navBrand.style.zIndex = '100'; // Ensure nav_brand is above background layer

  navBackgroundLayer.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
  navBackgroundLayer.style.transform = 'translateY(-100%)';
  navBackgroundLayer.style.opacity = '0';
  navBackgroundLayer.style.zIndex = '-1'; // Background layer below nav_left

  // Clean up existing scroll listener
  if (navbarState.scrollListener) {
    window.removeEventListener('scroll', navbarState.scrollListener);
  }

  const updateNavbar = (): void => {
    const currentScrollY = window.scrollY;
    const scrollDifference = currentScrollY - navbarState.lastScrollY;
    const isInTopViewport = currentScrollY <= VIEWPORT_HEIGHT_THRESHOLD;

    // Ignore small scroll movements
    if (Math.abs(scrollDifference) < SCROLL_THRESHOLD) {
      navbarState.ticking = false;
      return;
    }

    // Clear any existing timeout
    clearScrollTimeout();

    // Handle nav_left and nav_brand visibility based on scroll direction (only after 100vh)
    if (currentScrollY > VIEWPORT_HEIGHT_THRESHOLD) {
      if (scrollDifference > 0 && currentScrollY > SCROLL_HIDE_OFFSET) {
        // Scrolling down after 100vh - hide nav_left and nav_brand
        if (!navbarState.isNavLeftHidden) {
          navLeft.style.transform = 'translateY(calc(-100% - var(--_layout---spacing--xxlarge)))';
          navBrand.style.transform = 'translateY(calc(-100% - var(--_layout---spacing--xxlarge)))';
          navbarState.isNavLeftHidden = true;
        }
      } else if (scrollDifference < 0) {
        // Scrolling up after 100vh - show nav_left and nav_brand immediately
        if (navbarState.isNavLeftHidden) {
          navLeft.style.transform = 'translateY(0)';
          navBrand.style.transform = 'translateY(0)';
          navbarState.isNavLeftHidden = false;
        }
      }
    } else {
      // Within first 100vh - always show nav_left and nav_brand
      if (navbarState.isNavLeftHidden) {
        navLeft.style.transform = 'translateY(0)';
        navBrand.style.transform = 'translateY(0)';
        navbarState.isNavLeftHidden = false;
      }
    }

    // Handle nav_container_background-layer visibility after 100vh
    if (currentScrollY > VIEWPORT_HEIGHT_THRESHOLD) {
      if (scrollDifference < 0 && !navbarState.isBackgroundLayerVisible) {
        // Scrolling up after 100vh - show background layer
        navBackgroundLayer.style.transform = 'translateY(0%)';
        navBackgroundLayer.style.opacity = '1';
        navbarState.isBackgroundLayerVisible = true;
      } else if (scrollDifference > 0 && navbarState.isBackgroundLayerVisible) {
        // Scrolling down after 100vh - hide background layer
        navBackgroundLayer.style.transform = 'translateY(-100%)';
        navBackgroundLayer.style.opacity = '0';
        navbarState.isBackgroundLayerVisible = false;
      }
    } else {
      // Within first 100vh - hide background layer
      if (navbarState.isBackgroundLayerVisible) {
        navBackgroundLayer.style.transform = 'translateY(-100%)';
        navBackgroundLayer.style.opacity = '0';
        navbarState.isBackgroundLayerVisible = false;
      }
    }

    // Auto-show after inactivity (except in top 100vh)
    if (!isInTopViewport) {
      navbarState.scrollTimeout = setTimeout(() => {
        // Show nav_left and nav_brand
        if (navbarState.isNavLeftHidden) {
          navLeft.style.transform = 'translateY(0)';
          navBrand.style.transform = 'translateY(0)';
          navbarState.isNavLeftHidden = false;
        }

        // Show background layer if beyond 100vh
        if (currentScrollY > VIEWPORT_HEIGHT_THRESHOLD && !navbarState.isBackgroundLayerVisible) {
          navBackgroundLayer.style.transform = 'translateY(0%)';
          navBackgroundLayer.style.opacity = '1';
          navbarState.isBackgroundLayerVisible = true;
        }
      }, NAVBAR_SHOW_DELAY);
    }

    navbarState.lastScrollY = currentScrollY;
    navbarState.ticking = false;
  };

  // Optimized scroll handler with requestAnimationFrame
  navbarState.scrollListener = (): void => {
    if (!navbarState.ticking) {
      requestAnimationFrame(updateNavbar);
      navbarState.ticking = true;
    }
  };

  window.addEventListener('scroll', navbarState.scrollListener, { passive: true });
}

// ============================================================================
// SIDE NAVIGATION
// ============================================================================
/**
 * Initialise la navigation latérale (side nav)
 * - Au clic sur #side-nav : ouvre le menu latéral
 * - Le menu passe de transform: translate(-100%, 0px) à transform: translate(0%, 0px)
 * - Au clic ailleurs (sauf sur .nav_side ou ses enfants) : ferme le menu
 * - Gère le background layer avec effet de fade in/out
 */
export function initSideNav(): void {
  const sideNavButton = document.querySelector('[trigger=open-side-nav]') as HTMLElement;
  const navSide = document.querySelector('.nav_side') as HTMLElement;
  const backgroundLayer = document.querySelector('.nav_side_background-layer') as HTMLElement;
  const navSideModeles = document.querySelector('.nav_side_modeles') as HTMLElement;
  const navBrand = document.querySelector('.nav_brand') as HTMLElement;
  const navBackgroundLayer = document.querySelector(
    '.nav_container_background-layer'
  ) as HTMLElement;
  const navSideIconOpen = document.querySelector('.nav_side-icon-open') as HTMLElement;
  const navSideIconClose = document.querySelector('.nav_side-icon-close') as HTMLElement;

  if (!sideNavButton || !navSide || !backgroundLayer) {
    return;
  }

  // État du menu (fermé par défaut)
  let isOpen = false;

  // Store initial state of navBackgroundLayer before opening menu
  let navBackgroundLayerInitialState = {
    opacity: '0',
    transform: 'translateY(-100%)',
    visible: false,
  };

  // Fonction pour ouvrir le menu
  const openMenu = (): void => {
    // Store current state of navBackgroundLayer before hiding it
    if (navBackgroundLayer) {
      navBackgroundLayerInitialState = {
        opacity: navBackgroundLayer.style.opacity || '0',
        transform: navBackgroundLayer.style.transform || 'translateY(-100%)',
        visible: navbarState.isBackgroundLayerVisible,
      };

      // Force hide navBackgroundLayer when menu opens
      navBackgroundLayer.style.opacity = '0';
      navBackgroundLayer.style.transform = 'translateY(-100%)';
    }

    navSide.style.transform = 'translate(0%, 0px)';
    if (window.innerWidth > 991) {
      navSideModeles.style.transform = 'translate(0%, 0px)';
    }
    backgroundLayer.style.opacity = '0.75';
    backgroundLayer.style.pointerEvents = 'auto';
    document.body.style.overflow = 'hidden';

    // Hide nav_brand when menu is open
    if (navBrand) {
      navBrand.style.display = 'none';
    }

    // Show close icon and hide open icon when menu is open
    if (navSideIconClose) {
      navSideIconClose.style.display = 'flex';
    }
    if (navSideIconOpen) {
      navSideIconOpen.style.display = 'none';
    }

    isOpen = true;
  };

  // Fonction pour fermer le menu
  const closeMenu = (): void => {
    navSide.style.transform = 'translate(-100%, 0px)';
    if (window.innerWidth > 991) {
      navSideModeles.style.transform = 'translate(-100%, 0px)';
    }
    backgroundLayer.style.opacity = '0';
    backgroundLayer.style.pointerEvents = 'none';
    document.body.style.overflow = '';

    // Restore navBackgroundLayer to its initial state before menu was opened
    if (navBackgroundLayer) {
      navBackgroundLayer.style.opacity = navBackgroundLayerInitialState.opacity;
      navBackgroundLayer.style.transform = navBackgroundLayerInitialState.transform;
      navbarState.isBackgroundLayerVisible = navBackgroundLayerInitialState.visible;
    }

    // Show nav_brand when menu is closed
    if (navBrand) {
      navBrand.style.display = 'flex';
      navBrand.style.transition = 'opacity 0.3s ease';
      navBrand.style.opacity = '0';
      // Use setTimeout to allow the transition to work by separating the display:flex and opacity:1
      setTimeout(() => {
        if (navBrand) navBrand.style.opacity = '1';
      }, 0);
    }

    // Show open icon and hide close icon when menu is closed
    if (navSideIconOpen) {
      navSideIconOpen.style.display = 'flex';
    }
    if (navSideIconClose) {
      navSideIconClose.style.display = 'none';
    }

    isOpen = false;
  };

  // S'assurer que le menu est fermé au démarrage
  closeMenu();

  // Gestionnaire de clic sur le bouton d'ouverture
  sideNavButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Gestionnaire de clic sur le document pour fermer le menu
  document.addEventListener('click', (event) => {
    if (!isOpen) return;

    const target = event.target as HTMLElement;

    // Si le clic est sur .nav_side ou un de ses enfants, ne pas fermer
    if (navSide.contains(target)) {
      return;
    }

    // Si le clic est sur le bouton d'ouverture, ne pas fermer (géré par son propre gestionnaire)
    if (sideNavButton.contains(target)) {
      return;
    }

    // Sinon, fermer le menu
    closeMenu();
  });

  // Gestionnaire de clic sur le background layer pour fermer le menu
  backgroundLayer.addEventListener('click', () => {
    if (isOpen) {
      closeMenu();
    }
  });

  // Gestionnaire de clic sur les liens de navigation pour fermer le menu
  const navLinks = document.querySelectorAll('.nav_side_navigation-menu-link');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      // Ne pas fermer le menu si c'est le lien #trigger-side-modele
      if (isOpen && link.id !== 'trigger-side-modele') {
        closeMenu();
      }
    });
  });

  // Optionnel : fermer avec la touche Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      closeMenu();
    }
  });
}

// ============================================================================
// MOBILE SIDE MODELES
// ============================================================================
/**
 * Gère l'ouverture/fermeture de .nav_side_modeles sur mobile uniquement (< 767px)
 * - Au clic sur #trigger-side-modele : ouvre .nav_side_modeles (translateX: 0%)
 * - Au clic sur [trigger=back-side-mobile] : ferme .nav_side_modeles (translateX: -100%)
 * - Au clic sur .nav_left : ferme .nav_side_modeles (mobile only)
 */
export function initMobileSideModeles(): void {
  const triggerSideModele = document.querySelector('#trigger-side-modele') as HTMLElement;
  const backSideMobile = document.querySelector('[trigger=back-side-mobile]') as HTMLElement;
  const navSideModeles = document.querySelector('.nav_side_modeles') as HTMLElement;
  const navLeft = document.querySelector('.nav_side-button') as HTMLElement;

  if (!triggerSideModele || !backSideMobile || !navSideModeles) {
    return;
  }

  // Fonction pour ouvrir .nav_side_modeles sur mobile
  const openMobileModeles = (): void => {
    // Vérifier si on est sur mobile (< 767px)
    if (window.innerWidth >= 767) {
      return;
    }

    navSideModeles.style.transform = 'translateX(0%)';
  };

  // Fonction pour fermer .nav_side_modeles sur mobile
  const closeMobileModeles = (): void => {
    // Vérifier si on est sur mobile (< 767px)
    if (window.innerWidth >= 767) {
      return;
    }

    navSideModeles.style.transform = 'translateX(-100%)';
  };

  // Gestionnaire de clic sur #trigger-side-modele
  triggerSideModele.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMobileModeles();
  });

  // Gestionnaire de clic sur [trigger=back-side-mobile]
  backSideMobile.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMobileModeles();
  });

  // Gestionnaire de clic sur .nav_left pour fermer le menu sur mobile
  if (navLeft) {
    navLeft.addEventListener('click', () => {
      // Vérifier si on est sur mobile (< 767px)
      if (window.innerWidth < 767) {
        closeMobileModeles();
      }
    });
  }
}
