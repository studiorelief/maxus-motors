/**
 * ============================================================================
 * SYSTÈME DE CARTE INTERACTIVE AVEC GÉOLOCALISATION
 * ============================================================================
 *
 * Fonctionnalités principales
 * - Géolocalisation GPS et saisie d'adresse avec autocomplétion
 * - Calcul d'itinéraires et de distances (Mapbox Directions)
 * - Tri automatique des concessions par distance
 * - UI/UX: popups, survols, focus et indicateurs de chargement
 *
 * Intégration cross-page (CTA → Concessions)
 * - Consomme `localStorage.concessionIntent`
 *   - { type: 'address', address }
 *   - { type: 'geolocate' }
 * - Adresse: dispatch `window` event 'concession-intent-address' (détail { address })
 * - Géolocalisation: clique sur le bouton de géolocalisation
 * - Inclut un petit retry pour attendre l'input si le DOM se monte lentement
 *
 * Maintenance
 * - Les sélecteurs sont regroupés dans SELECTORS
 * - Les appels API sont encapsulés: getAddressSuggestions, geocodeAddress, getDirections
 * - Les composants UI (cards, popups, markers) sont organisés par section
 *
 * @author Studio Relief
 * @version 2.0.0
 */

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Token d'accès Mapbox
 * @warning À remplacer par votre propre token en production
 */
const MAPBOX_ACCESS_TOKEN =
  'pk.eyJ1Ijoic3R1ZGlvLXJlbGllZiIsImEiOiJjbWZuczN3dmswNXpxMmtxd2VwNmtuODhmIn0.yWb8YSp3FSuOSCrB3pWtxQ';

/**
 * Configuration par défaut de la carte
 */
const MAP_CONFIG = {
  /** Coordonnées du centre de la France */
  defaultCenter: [2.213749, 46.227638] as [number, number],
  /** Niveau de zoom initial */
  defaultZoom: 5,
  /** Style personnalisé de la carte */
  style: 'mapbox://styles/studio-relief/cmfns9ba8002n01s93qgi06d3',
  /** Projection 3D globe */
  projection: 'globe' as const,
} as const;

/**
 * Configuration des appels API
 */
const API_CONFIG = {
  /** Délai entre les appels API (ms) */
  rateLimitDelay: 150,
  /** Timeout des requêtes (ms) */
  requestTimeout: 10000,
  /** Timeout pour la géolocalisation (ms) */
  geolocationTimeout: 30000,
  /** Pays par défaut pour le géocodage */
  defaultCountry: 'fr',
} as const;

/**
 * Sélecteurs CSS pour les éléments DOM
 */
const SELECTORS = {
  // Carte et conteneurs
  mapContainer: 'map',
  projectCardsContainer: '.concessions_map_collection-list, .w-dyn-list, .concessions_map_wrapper',

  // Contrôles utilisateur
  geolocationButton: '#geolocalisation',
  addressInput: '#address',
  addressSearchButton: '#address-search',
  itineraryButton: '[trigger=itineraire]',

  // Éléments de contenu
  projectCards: '.concessions_map_cards',
  cardLatitude: '.projets_map_card-lat',
  cardLongitude: '.projets_map_card-lon',
  cardPopup: '.concessions_map_popup',
  topDistance: '.concessions_map_cards-top-distance',

  // Affichage des données
  distanceElements: ['#it-time', '[id*="it-time"]', '.it-time', '[data-element="it-time"]'],

  // Marqueurs
  starMarker: '.concessions_map_pin',
  userMarker: '.user-location-marker',
} as const;

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Réponse de l'API Directions de Mapbox
 */
interface DirectionsResponse {
  routes: {
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
  }[];
}

/**
 * Suggestion d'adresse de l'API Geocoding
 */
interface AddressSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
}

/**
 * Données d'une concession avec distance calculée
 */
interface ConcessionWithDistance {
  element: Element;
  distance: number;
  distanceText: string;
}

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

/** Position actuelle de l'utilisateur */
let userLocation: [number, number] | null = null;

/** Timeout pour le debounce du tri */
let sortDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// UTILITAIRES DOM
// ============================================================================

/**
 * Trouve un élément d'affichage de distance dans une carte
 * @param cardElement Élément de carte à analyser
 * @returns Élément de distance trouvé ou null
 */
function findDistanceElement(cardElement: Element): Element | null {
  for (const selector of SELECTORS.distanceElements) {
    const element = cardElement.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Affiche/masque le bandeau top-distance en fonction de la présence d'une localisation
 */
function setTopDistanceVisibility(visible: boolean): void {
  document.querySelectorAll(SELECTORS.topDistance).forEach((el) => {
    (el as HTMLElement).style.display = visible ? 'flex' : 'none';
  });
}

/**
 * Fait disparaître en fondu le contenu du popup projet, puis supprime le popup
 */
function removePopupWithFade(popup: mapboxgl.Popup): void {
  try {
    const popupRoot = popup.getElement();
    if (!popupRoot) {
      popup.remove();
      return;
    }

    // Si déjà en cours de fade, ne pas attacher deux fois
    if (popupRoot.classList.contains('is-fading')) {
      return;
    }

    popupRoot.classList.add('is-fading');

    const finalize = (): void => {
      popupRoot.removeEventListener('transitionend', finalize);
      // Sécurité si le DOM a changé entre temps
      try {
        popup.remove();
      } catch {
        // ignore
      }
    };

    popupRoot.addEventListener('transitionend', finalize);
    // Filet de sécurité si l'évènement ne se déclenche pas
    setTimeout(finalize, 300);
  } catch {
    popup.remove();
  }
}

/**
 * Supprime le marqueur utilisateur existant
 */
function removeExistingUserMarker(): void {
  const existingMarker = document.querySelector(SELECTORS.userMarker);
  existingMarker?.remove();
}

/**
 * Crée un marqueur pour la position utilisateur
 * @param map Instance de la carte
 * @param coordinates Coordonnées [longitude, latitude]
 * @param popupContent Contenu HTML du popup
 * @returns Marqueur créé
 */
function createUserMarker(
  map: mapboxgl.Map,
  coordinates: [number, number],
  popupContent: string
): mapboxgl.Marker {
  // Resolve theme color from CSS variable with fallback
  const resolvedColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--_theme---background--tertiary-default')
      .trim() || '#000000';

  const marker = new mapboxgl.Marker({
    color: resolvedColor,
  })
    .setLngLat(coordinates)
    .addTo(map);

  marker.getElement().classList.add('user-location-marker');

  const popup = new mapboxgl.Popup({
    offset: 25,
    closeButton: true,
  }).setHTML(popupContent);

  marker.setPopup(popup);
  return marker;
}

/**
 * Anime la carte vers une position
 * @param map Instance de la carte
 * @param coordinates Coordonnées de destination
 * @param zoom Niveau de zoom (défaut: 15)
 */
function flyToLocation(map: mapboxgl.Map, coordinates: [number, number], zoom: number = 15): void {
  map.flyTo({
    center: coordinates,
    zoom,
    essential: true,
    duration: 2500,
  });
}

// ============================================================================
// INTERFACE UTILISATEUR - CARDS
// ============================================================================

/**
 * Crée une card demandant à l'utilisateur de se localiser
 */
function createLocationRequestCard(): void {
  // Nettoyer l'ancienne implémentation si présente
  const legacyCard = document.querySelector('.location-request-card');
  legacyCard?.remove();

  // Utiliser l'élément existant `.concessions_map_localization`
  const panel = document.querySelector('.concessions_map_localization') as HTMLElement | null;
  if (!panel) {
    console.error("Élément '.concessions_map_localization' non trouvé");
    return;
  }

  // Rendre visible le panneau
  panel.style.display = 'block';

  // Attacher les événements une seule fois
  if (!panel.dataset.localizationBound) {
    const closeButton = panel.querySelector('.concessions_map_localization-close');
    const geoButton = panel.querySelector('#popup-geolocalisation');
    const addressButton = panel.querySelector('#popup-address');

    closeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      panel.style.display = 'none';
    });

    geoButton?.addEventListener('click', (e) => {
      e.preventDefault();
      const geoButtonMain = document.querySelector(
        SELECTORS.geolocationButton
      ) as HTMLElement | null;
      if (geoButtonMain) {
        geoButtonMain.click();
        panel.style.display = 'none';
      }
    });

    addressButton?.addEventListener('click', (e) => {
      e.preventDefault();
      const addressInput = document.querySelector(
        SELECTORS.addressInput
      ) as HTMLInputElement | null;
      if (addressInput) {
        addressInput.focus();
        panel.style.display = 'none';
      }
    });

    panel.dataset.localizationBound = 'true';
  }
}

/**
 * Supprime la card de demande de localisation
 */
function removeLocationRequestCard(): void {
  // Masquer le nouveau panneau si présent
  const panel = document.querySelector('.concessions_map_localization') as HTMLElement | null;
  if (panel) {
    panel.style.display = 'none';
  }

  // Nettoyer l'ancienne implémentation si toujours présente
  const legacyCard = document.querySelector('.location-request-card');
  legacyCard?.remove();
}

/**
 * Crée une card d'informations d'itinéraire
 * @param distance Distance en km
 * @param duration Durée en minutes
 */
function createRouteInfoCard(distance: string, duration: number): void {
  // Nettoyer l'ancienne implémentation si présente
  const legacyCard = document.querySelector('.route-info-card');
  legacyCard?.remove();

  // Utiliser l'élément existant `.concessions_map_itineraire`
  const panel = document.querySelector('.concessions_map_itineraire') as HTMLElement | null;
  if (!panel) {
    console.error("Élément '.concessions_map_itineraire' non trouvé");
    return;
  }

  // Rendre visible le panneau
  panel.style.display = 'block';

  // Renseigner les valeurs
  const distanceEl = panel.querySelector('#popup-distance') as HTMLElement | null;
  if (distanceEl) {
    distanceEl.textContent = `${distance} KM`;
  }

  const durationEl = panel.querySelector('#popup-duree, .popup-duree') as HTMLElement | null;
  if (durationEl) {
    durationEl.textContent = `${duration} MIN`;
  }

  // Attacher les événements une seule fois
  if (!panel.dataset.itineraryBound) {
    const closeButton = panel.querySelector('.concessions_map_itineraire-close');
    closeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      panel.style.display = 'none';
    });
    panel.dataset.itineraryBound = 'true';
  }
}

// ============================================================================
// AUTOCOMPLÉTION D'ADRESSE
// ============================================================================

/**
 * Crée le conteneur de suggestions d'adresses
 * @param inputElement Input d'adresse
 * @returns Conteneur créé
 */
function createSuggestionsContainer(inputElement: HTMLInputElement): HTMLElement {
  const existingContainer = document.querySelector('.address-suggestions');
  existingContainer?.remove();

  const container = document.createElement('div');
  container.className = 'address-suggestions';

  const inputRect = inputElement.getBoundingClientRect();
  container.style.position = 'absolute';
  container.style.top = `${inputRect.bottom + window.scrollY}px`;
  container.style.left = `${inputRect.left + window.scrollX}px`;
  container.style.width = `${inputRect.width}px`;

  document.body.appendChild(container);
  return container;
}

/**
 * Affiche les suggestions d'adresses
 * @param suggestions Liste des suggestions
 * @param container Conteneur des suggestions
 * @param inputElement Input d'adresse
 * @param onSelect Callback de sélection
 */
function displaySuggestions(
  suggestions: AddressSuggestion[],
  container: HTMLElement,
  inputElement: HTMLInputElement,
  onSelect: (suggestion: AddressSuggestion) => void
): void {
  container.innerHTML = '';

  if (suggestions.length === 0) {
    container.style.display = 'none';
    return;
  }

  suggestions.forEach((suggestion) => {
    const suggestionElement = document.createElement('div');
    suggestionElement.className = 'address-suggestion';
    suggestionElement.innerHTML = `
      <div class="suggestion-text">${suggestion.text}</div>
      <div class="suggestion-place">${suggestion.place_name}</div>
    `;

    suggestionElement.addEventListener('click', () => {
      onSelect(suggestion);
      container.style.display = 'none';
    });

    suggestionElement.addEventListener('mouseenter', () => {
      container.querySelectorAll('.address-suggestion').forEach((el) => {
        el.classList.remove('selected');
      });
      suggestionElement.classList.add('selected');
    });

    container.appendChild(suggestionElement);
  });

  container.style.display = 'block';
}

/**
 * Masque les suggestions d'adresses
 */
function hideSuggestions(): void {
  const container = document.querySelector('.address-suggestions') as HTMLElement;
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Empêche le saut en haut de page pour les liens avec href="#"
 */
// (removed) global no-hash jump handler

// ============================================================================
// API MAPBOX
// ============================================================================

/**
 * Calcule un itinéraire entre deux points
 * @param start Coordonnées de départ
 * @param end Coordonnées d'arrivée
 * @returns Données de l'itinéraire
 */
async function getDirections(
  start: [number, number],
  end: [number, number]
): Promise<DirectionsResponse['routes'][0]> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0];
    }

    throw new Error('Aucun itinéraire trouvé');
  } catch (error) {
    console.error("Erreur lors du calcul de l'itinéraire:", error);
    throw error;
  }
}

/**
 * Récupère les suggestions d'adresses
 * @param query Texte de recherche
 * @returns Liste des suggestions
 */
async function getAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  // Détecter si la requête est un code postal (2 à 5 chiffres pour l'autocomplétion)
  const isPostalCode = /^\d{2,5}$/.test(cleanQuery);

  // Adapter les types de recherche selon le format de la requête
  let types = 'place,locality,neighborhood,address';
  if (isPostalCode) {
    // Pour les codes postaux, inclure spécifiquement postcode et prioriser les résultats
    types = 'postcode,place,locality,address';
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanQuery)}.json?country=${API_CONFIG.defaultCountry}&access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&types=${types}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features.map(
        (feature: { id: string; place_name: string; center: [number, number]; text: string }) => ({
          id: feature.id,
          place_name: feature.place_name,
          center: feature.center,
          text: feature.text,
        })
      );
    }

    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des suggestions:', error);
    return [];
  }
}

/**
 * Géocode une adresse
 * @param address Adresse à géocoder
 * @returns Coordonnées [longitude, latitude]
 */
async function geocodeAddress(address: string): Promise<[number, number]> {
  const cleanAddress = address.trim();
  if (!cleanAddress) {
    throw new Error('Adresse vide');
  }

  // Détecter si l'adresse est un code postal (5 chiffres)
  const isPostalCode = /^\d{5}$/.test(cleanAddress);

  // Adapter les types de recherche selon le format de l'adresse
  let types = 'place,locality,neighborhood,address';
  if (isPostalCode) {
    // Pour les codes postaux, inclure spécifiquement postcode
    types = 'postcode,place,locality,address';
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanAddress)}.json?country=${API_CONFIG.defaultCountry}&access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=${types}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return [longitude, latitude];
    }

    throw new Error(`Aucun résultat trouvé pour "${address}"`);
  } catch (error) {
    console.error('Erreur lors du géocodage:', error);
    throw error;
  }
}

// ============================================================================
// GESTION DES ITINÉRAIRES SUR LA CARTE
// ============================================================================

/**
 * Ajoute un itinéraire sur la carte
 * @param map Instance de la carte
 * @param route Données de l'itinéraire
 */
function addRouteToMap(map: mapboxgl.Map, route: DirectionsResponse['routes'][0]): void {
  // Supprimer l'itinéraire existant
  if (map.getSource('route')) {
    map.removeLayer('route');
    map.removeSource('route');
  }

  // Ajouter le nouvel itinéraire
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: route.geometry,
    },
  });

  // Resolve route color from CSS variable with fallback
  const routeColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--_theme---background--secondary-default')
      .trim() || '#3887be';

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': routeColor,
      'line-width': 5,
      'line-opacity': 0.75,
    },
  });
}

/**
 * Ajuste la vue pour afficher tout l'itinéraire
 * @param map Instance de la carte
 * @param coordinates Coordonnées de l'itinéraire
 */
function fitMapToRoute(map: mapboxgl.Map, coordinates: [number, number][]): void {
  const bounds = coordinates.reduce(
    (bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
      return bounds.extend(coord);
    },
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
  );

  map.fitBounds(bounds, {
    padding: 50,
    duration: 2000,
  });
}

/**
 * Effectue le calcul et l'affichage d'un itinéraire depuis la card fournie
 */
async function performItineraryFromCard(
  map: mapboxgl.Map,
  cardElement: Element,
  loadingEl?: HTMLElement
): Promise<void> {
  if (!userLocation) {
    createLocationRequestCard();
    return;
  }

  const latElement = cardElement.querySelector(SELECTORS.cardLatitude);
  const lonElement = cardElement.querySelector(SELECTORS.cardLongitude);

  if (!latElement?.textContent || !lonElement?.textContent) {
    console.error('Coordonnées de destination non trouvées');
    return;
  }

  const destinationLat = parseFloat(latElement.textContent);
  const destinationLon = parseFloat(lonElement.textContent);
  const destination: [number, number] = [destinationLon, destinationLat];

  try {
    loadingEl?.classList.add('loading');

    const route = await getDirections(userLocation, destination);
    addRouteToMap(map, route);
    fitMapToRoute(map, route.geometry.coordinates);

    const distance = (route.distance / 1000).toFixed(1);
    const duration = Math.round(route.duration / 60);

    const distanceElement =
      findDistanceElement(cardElement) || document.querySelector(SELECTORS.distanceElements[0]);
    if (distanceElement) {
      distanceElement.textContent = `${distance} KM`;
    }

    createRouteInfoCard(distance, duration);
  } catch (error) {
    console.error("Erreur lors du calcul de l'itinéraire:", error);
    alert("Impossible de calculer l'itinéraire. Veuillez réessayer.");
  } finally {
    loadingEl?.classList.remove('loading');
  }
}

// ============================================================================
// SYSTÈME DE TRI DES CONCESSIONS
// ============================================================================

/**
 * Extrait la valeur numérique de distance d'un élément
 * @param distanceElement Élément contenant la distance
 * @returns Distance en km ou Infinity si invalide
 */
function extractDistanceValue(distanceElement: Element | null): number {
  if (!distanceElement?.textContent) {
    return Infinity;
  }

  const text = distanceElement.textContent.trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*km/i);

  if (match) {
    return parseFloat(match[1]);
  }

  // En cours de calcul ou erreur
  if (text.toLowerCase().includes('calcul')) {
    return Infinity;
  }

  return Infinity;
}

/**
 * Trie les concessions par distance (avec debounce)
 * @param immediate Si true, trie immédiatement
 */
function sortConcessionsByDistance(immediate: boolean = false): void {
  if (!immediate) {
    if (sortDebounceTimeout) {
      clearTimeout(sortDebounceTimeout);
    }

    sortDebounceTimeout = setTimeout(() => {
      sortConcessionsByDistanceImmediate();
    }, 500);

    return;
  }

  sortConcessionsByDistanceImmediate();
}

/**
 * Effectue le tri immédiat des concessions
 */
function sortConcessionsByDistanceImmediate(): void {
  // Trouver le conteneur
  const containers = SELECTORS.projectCardsContainer.split(', ');
  let container: Element | null = null;

  for (const selector of containers) {
    container = document.querySelector(selector.trim());
    if (container) break;
  }

  if (!container) {
    const firstCard = document.querySelector(SELECTORS.projectCards);
    if (firstCard) {
      container = firstCard.parentElement;
    }
  }

  if (!container) {
    return;
  }

  // Afficher l'animation de tri
  container.classList.add('concessions-sorting');

  const cards = Array.from(container.querySelectorAll(SELECTORS.projectCards));
  if (cards.length === 0) {
    container.classList.remove('concessions-sorting');
    return;
  }

  // Créer les données de tri
  const cardsWithDistance: ConcessionWithDistance[] = cards.map((card) => {
    const distanceElement = findDistanceElement(card);
    const distance = extractDistanceValue(distanceElement);
    return {
      element: card,
      distance: distance,
      distanceText: distanceElement?.textContent || 'N/A',
    };
  });

  // Trier par distance croissante
  cardsWithDistance.sort((a, b) => {
    if (a.distance === Infinity && b.distance === Infinity) return 0;
    if (a.distance === Infinity) return 1;
    if (b.distance === Infinity) return -1;
    return a.distance - b.distance;
  });

  // Réorganiser dans le DOM
  const fragment = document.createDocumentFragment();
  cardsWithDistance.forEach(({ element }) => {
    fragment.appendChild(element);
  });
  container.appendChild(fragment);

  // Supprimer l'animation
  setTimeout(() => {
    container.classList.remove('concessions-sorting');
  }, 300);
}

// ============================================================================
// CALCUL DES DISTANCES
// ============================================================================

/**
 * Calcule et met à jour toutes les distances
 * @param map Instance de la carte
 * @param userLocation Position utilisateur
 */
async function updateAllDistances(
  map: mapboxgl.Map,
  userLocation: [number, number]
): Promise<void> {
  const cards = document.querySelectorAll(SELECTORS.projectCards);

  // Ajouter l'état de chargement
  cards.forEach((cardElement) => {
    const distanceElement = findDistanceElement(cardElement);
    if (distanceElement) {
      distanceElement.classList.add('distance-loading');
      distanceElement.textContent = 'Calcul';
    }
  });

  // Calculer les distances
  for (const cardElement of cards) {
    try {
      const latElement = cardElement.querySelector(SELECTORS.cardLatitude);
      const lonElement = cardElement.querySelector(SELECTORS.cardLongitude);

      if (!latElement?.textContent || !lonElement?.textContent) {
        console.error('Coordonnées manquantes pour la carte:', cardElement);
        continue;
      }

      const destinationLat = parseFloat(latElement.textContent);
      const destinationLon = parseFloat(lonElement.textContent);
      const destination: [number, number] = [destinationLon, destinationLat];

      const route = await getDirections(userLocation, destination);
      const distance = (route.distance / 1000).toFixed(1);

      const distanceElement = findDistanceElement(cardElement);
      if (distanceElement) {
        distanceElement.classList.remove('distance-loading');
        distanceElement.textContent = `${distance} KM`;
      }

      await new Promise((resolve) => setTimeout(resolve, API_CONFIG.rateLimitDelay));
    } catch (error) {
      console.error('Erreur lors du calcul de distance:', error);

      const distanceElement = findDistanceElement(cardElement);
      if (distanceElement) {
        distanceElement.classList.remove('distance-loading');
        distanceElement.textContent = '-- KM';
      }
    }
  }

  // Trier après calcul complet
  sortConcessionsByDistance(true);
}

// ============================================================================
// GÉOLOCALISATION
// ============================================================================

/**
 * Configure la fonctionnalité de géolocalisation
 * @param map Instance de la carte
 */
function setupGeolocation(map: mapboxgl.Map): void {
  const geoButton = document.querySelector(SELECTORS.geolocationButton);
  if (!geoButton) {
    console.error('Bouton de géolocalisation non trouvé');
    return;
  }

  geoButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      console.error('Géolocalisation non supportée');
      alert("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }

    // geoButton.classList.add('loading');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        userLocation = [longitude, latitude];
        removeLocationRequestCard();

        const addressInput = document.querySelector(SELECTORS.addressInput) as HTMLInputElement;
        if (addressInput) {
          addressInput.value = '';
          addressInput.placeholder = 'Géolocalisation active';
        }

        // geoButton.classList.remove('loading');
        removeExistingUserMarker();
        flyToLocation(map, [longitude, latitude]);
        setTopDistanceVisibility(true);

        const popupContent = `
          <div class="concessions_map_popup">
            <div class="concessions_map_popup-content">
            <h6>Ma position</h5>
            </div>
          </div>
        `;
        createUserMarker(map, [longitude, latitude], popupContent);

        try {
          await updateAllDistances(map, [longitude, latitude]);
        } catch (error) {
          console.error('Erreur lors du calcul des distances:', error);
        }
      },
      (error) => {
        // geoButton.classList.remove('loading');

        let errorMessage = 'Erreur de géolocalisation';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "L'accès à la géolocalisation a été refusé";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Les informations de localisation ne sont pas disponibles';
            break;
          case error.TIMEOUT:
            errorMessage = 'La demande de géolocalisation a expiré';
            break;
        }

        console.error('Erreur de géolocalisation:', error);
        alert(errorMessage);
      },
      {
        enableHighAccuracy: false, // Désactivé pour éviter les timeouts
        timeout: API_CONFIG.geolocationTimeout,
        maximumAge: 300000,
      }
    );
  });
}

// ============================================================================
// SAISIE D'ADRESSE
// ============================================================================

/**
 * Configure la saisie d'adresse avec autocomplétion
 * @param map Instance de la carte
 */
function setupAddressInput(map: mapboxgl.Map): void {
  const addressInput = document.querySelector(SELECTORS.addressInput) as HTMLInputElement;
  if (!addressInput) {
    console.error("Input d'adresse non trouvé");
    return;
  }

  let suggestionsContainer: HTMLElement | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedIndex = -1;
  let currentSuggestions: AddressSuggestion[] = [];

  /**
   * Traite une adresse saisie ou sélectionnée
   */
  const processAddress = async (address: string, coordinates?: [number, number]): Promise<void> => {
    if (!address.trim()) return;

    hideSuggestions();

    try {
      addressInput.classList.add('loading');
      addressInput.disabled = true;

      const [longitude, latitude] = coordinates || (await geocodeAddress(address));

      userLocation = [longitude, latitude];
      removeLocationRequestCard();
      removeExistingUserMarker();
      flyToLocation(map, [longitude, latitude]);
      setTopDistanceVisibility(true);

      const popupContent = `
        <div>
          <h3>Votre adresse</h3>
          <p>${address}</p>
          <p>Latitude: ${latitude.toFixed(6)}</p>
          <p>Longitude: ${longitude.toFixed(6)}</p>
        </div>
      `;
      createUserMarker(map, [longitude, latitude], popupContent);

      try {
        await updateAllDistances(map, [longitude, latitude]);
      } catch (error) {
        console.error('Erreur lors du calcul des distances:', error);
      }
    } catch (error) {
      console.error("Erreur lors du traitement de l'adresse:", error);
      alert(
        `Impossible de localiser "${address}". Vérifiez l'orthographe ou essayez avec un code postal.`
      );
    } finally {
      addressInput.classList.remove('loading');
      addressInput.disabled = false;
    }
  };

  /**
   * Recherche et affiche les suggestions
   */
  const searchSuggestions = async (query: string): Promise<void> => {
    if (query.length < 2) {
      hideSuggestions();
      return;
    }

    try {
      const suggestions = await getAddressSuggestions(query);
      currentSuggestions = suggestions;
      selectedIndex = -1;

      if (!suggestionsContainer) {
        suggestionsContainer = createSuggestionsContainer(addressInput);
      }

      displaySuggestions(suggestions, suggestionsContainer, addressInput, (suggestion) => {
        addressInput.value = suggestion.place_name;
        processAddress(suggestion.place_name, suggestion.center);
      });
    } catch (error) {
      console.error('Erreur lors de la recherche de suggestions:', error);
    }
  };

  /**
   * Met à jour la suggestion sélectionnée
   */
  const updateSelectedSuggestion = (): void => {
    if (!suggestionsContainer) return;

    const suggestionElements = suggestionsContainer.querySelectorAll('.address-suggestion');
    suggestionElements.forEach((el, index) => {
      el.classList.toggle('selected', index === selectedIndex);
    });
  };

  // Événements
  addressInput.addEventListener('input', () => {
    const query = addressInput.value.trim();

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(() => {
      searchSuggestions(query);
    }, 300);
  });

  addressInput.addEventListener('keydown', (event) => {
    if (!suggestionsContainer || currentSuggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelectedSuggestion();
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelectedSuggestion();
        break;

      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
          const suggestion = currentSuggestions[selectedIndex];
          addressInput.value = suggestion.place_name;
          processAddress(suggestion.place_name, suggestion.center);
        } else {
          const address = addressInput.value.trim();
          if (address) {
            processAddress(address);
          }
        }
        break;

      case 'Escape':
        hideSuggestions();
        break;
    }
  });

  // Masquer les suggestions au clic ailleurs
  document.addEventListener('click', (event) => {
    if (
      !addressInput.contains(event.target as Node) &&
      !suggestionsContainer?.contains(event.target as Node)
    ) {
      hideSuggestions();
    }
  });

  // Bouton de recherche optionnel
  const searchButton =
    document.querySelector(SELECTORS.addressSearchButton) ||
    document.querySelector('[data-address-search]') ||
    addressInput.nextElementSibling;

  if (searchButton) {
    searchButton.addEventListener('click', async () => {
      const address = addressInput.value.trim();
      if (address) {
        await processAddress(address);
      }
    });
  }

  // Consommation cross-page via événement personnalisé
  window.addEventListener('concession-intent-address', (evt: Event) => {
    const { detail } = evt as CustomEvent<{ address: string }>;
    if (!detail?.address) return;
    addressInput.value = detail.address;
    // Lancer le même flux que le bouton de recherche
    void processAddress(detail.address);
  });
}

// ============================================================================
// GESTION DES ITINÉRAIRES
// ============================================================================

/**
 * Configure la fonctionnalité d'itinéraires
 * @param map Instance de la carte
 */
function setupItinerary(map: mapboxgl.Map): void {
  // Délégation globale pour les clics sur le bouton d'itinéraire
  document.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;

    const trigger = target.matches('[trigger=itineraire]')
      ? target
      : (target.closest('[trigger=itineraire]') as HTMLElement | null);
    if (!trigger) return;

    event.preventDefault();

    const cardElement = trigger.closest(SELECTORS.projectCards);
    if (!cardElement) {
      console.error('Carte associée non trouvée');
      return;
    }

    await performItineraryFromCard(map, cardElement, trigger);
  });

  // Sécurité: attacher aussi un listener direct sur chaque trigger présent au chargement
  document.querySelectorAll(SELECTORS.itineraryButton).forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const card = (btn as HTMLElement).closest(SELECTORS.projectCards);
      if (card) {
        await performItineraryFromCard(map, card, btn as HTMLElement);
      }
    });
  });
}

// ============================================================================
// INITIALISATION PRINCIPALE
// ============================================================================

/**
 * Initialise la carte avec toutes ses fonctionnalités
 * @returns Instance de la carte Mapbox ou null si le conteneur n'existe pas
 */
export function initMap(): mapboxgl.Map | null {
  try {
    // Vérifier la présence du conteneur de la carte
    const mapContainer = document.getElementById(SELECTORS.mapContainer);
    if (!mapContainer) {
      // console.error(
      //   `Conteneur de carte '${SELECTORS.mapContainer}' non trouvé sur cette page. Initialisation de la carte annulée.`
      // );
      return null;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: SELECTORS.mapContainer,
      style: MAP_CONFIG.style,
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      projection: MAP_CONFIG.projection,
    });

    // Par défaut, masquer le bandeau tant qu'aucune localisation/adresse n'est définie
    setTopDistanceVisibility(false);

    // Désactiver le zoom à la molette pour permettre le scroll de page
    // et garder le zoom au pincement (pinch) uniquement sur mobile/touch
    // map.scrollZoom.disable();
    map.addControl(new mapboxgl.NavigationControl());
    map.scrollZoom.enable();
    map.touchZoomRotate.enable();

    // Empêcher le scroll de page lorsque le curseur est sur la carte
    const mapEl = document.getElementById(SELECTORS.mapContainer);
    if (mapEl) {
      const stopScrollOnMap = (e: Event): void => {
        e.preventDefault();
      };
      mapEl.addEventListener('wheel', stopScrollOnMap, { passive: false });
      mapEl.addEventListener('touchmove', stopScrollOnMap, { passive: false });
    }

    // Optionnel: empêcher la rotation au geste à deux doigts
    // map.touchZoomRotate.disableRotation();

    // Empêcher les sauts de page sur les liens factices (href="#")
    document.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('a[href="#"]') as HTMLAnchorElement | null;
      if (link) {
        e.preventDefault();
      }
    });

    // Raccourcis clavier: 'z' = zoom +, 's' = zoom - (quand la carte est focus)
    const kbContainer = map.getCanvasContainer();
    if (!kbContainer.hasAttribute('tabindex')) {
      kbContainer.setAttribute('tabindex', '0');
    }
    kbContainer.addEventListener('keydown', (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        map.zoomIn({ duration: 250 });
      } else if (key === 's') {
        e.preventDefault();
        map.zoomOut({ duration: 250 });
      }
    });

    // Variables pour la gestion des popups
    let currentClickedMarker: HTMLDivElement | undefined;
    let currentClickedItem: Element | undefined;
    let isClickActive = false;
    const allPopups: mapboxgl.Popup[] = [];
    const allMarkers: HTMLDivElement[] = [];
    const hoverTimeouts = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

    // Utilitaires pour la gestion des timeouts
    const clearElementTimeout = (element: HTMLElement): void => {
      const timeout = hoverTimeouts.get(element);
      if (timeout) {
        clearTimeout(timeout);
        hoverTimeouts.delete(element);
      }
    };

    const setElementTimeout = (element: HTMLElement, callback: () => void, delay: number): void => {
      clearElementTimeout(element);
      const timeout = setTimeout(callback, delay);
      hoverTimeouts.set(element, timeout);
    };

    // Fonction de nettoyage global
    const clearAllPopupsAndMarkers = (): void => {
      allPopups.forEach((popup) => popup.remove());
      allMarkers.forEach((marker) => {
        marker.classList.remove('show', 'active');
      });
      document.querySelectorAll(SELECTORS.projectCards).forEach((el) => {
        el.classList.remove('active');
      });
      hoverTimeouts.forEach((timeout) => clearTimeout(timeout));
      hoverTimeouts.clear();
      currentClickedMarker = undefined;
      currentClickedItem = undefined;
      isClickActive = false;
    };

    // Configuration des fonctionnalités
    setupGeolocation(map);
    setupAddressInput(map);
    setupItinerary(map);

    // Consommer une intention stockée (CTA cross-page) en attendant que le DOM soit prêt
    try {
      const raw = localStorage.getItem('concessionIntent');
      if (raw) {
        const intent = JSON.parse(raw) as { type: 'address' | 'geolocate'; address?: string };

        const tryConsume = (retries: number = 20): void => {
          const addressInput = document.querySelector(
            SELECTORS.addressInput
          ) as HTMLInputElement | null;
          if (intent.type === 'address' && intent.address) {
            if (addressInput) {
              // Préférer un évènement dédié pour appeler processAddress directement
              const ev = new CustomEvent('concession-intent-address', {
                detail: { address: intent.address },
              });
              window.dispatchEvent(ev);
              localStorage.removeItem('concessionIntent');
              return;
            }
          } else if (intent.type === 'geolocate') {
            const geoButton = document.querySelector(
              SELECTORS.geolocationButton
            ) as HTMLElement | null;
            if (geoButton) {
              geoButton.click();
              localStorage.removeItem('concessionIntent');
              return;
            }
          }

          if (retries > 0) {
            setTimeout(() => tryConsume(retries - 1), 150);
          }
        };

        // Lancer la consommation asynchrone
        tryConsume();
      }
    } catch {
      // ignore malformed intents
    }

    // Configuration des cartes de projets
    document.querySelectorAll(SELECTORS.projectCards).forEach((element, index) => {
      const latElement = element.querySelector(SELECTORS.cardLatitude);
      const lonElement = element.querySelector(SELECTORS.cardLongitude);
      const popupElement = element.querySelector(SELECTORS.cardPopup);
      const originalMarkerElement = document.querySelector(SELECTORS.starMarker) as HTMLDivElement;

      if (!latElement?.textContent || !lonElement?.textContent || !originalMarkerElement) {
        console.error('Éléments manquants pour la carte:', element);
        return;
      }

      const lat = parseFloat(latElement.textContent);
      const lon = parseFloat(lonElement.textContent);

      // Créer le popup
      const popup = new mapboxgl.Popup({
        offset: 1.5 * 16,
        closeButton: true,
        maxWidth: 'auto',
      }).setHTML(popupElement?.outerHTML || '');

      // Créer le marqueur
      const markerElement = originalMarkerElement.cloneNode(true) as HTMLDivElement;
      markerElement.id = `marker-${index}`;

      allPopups.push(popup);
      allMarkers.push(markerElement);

      new mapboxgl.Marker(markerElement).setLngLat([lon, lat]).setPopup(popup).addTo(map);

      // Événements du popup
      popup.on('open', () => {
        const popupDOMElement = popup.getElement();
        if (popupDOMElement && !popupDOMElement.dataset.eventsAttached) {
          popupDOMElement.dataset.eventsAttached = 'true';

          popupDOMElement.addEventListener('mouseenter', () => {
            clearElementTimeout(markerElement);
            clearElementTimeout(element as HTMLElement);
          });

          popupDOMElement.addEventListener('mouseleave', () => {
            if (isClickActive && currentClickedMarker === markerElement) {
              return;
            }

            setElementTimeout(
              markerElement,
              () => {
                if (currentClickedMarker !== markerElement || !isClickActive) {
                  removePopupWithFade(popup);
                  markerElement.classList.remove('show', 'active');
                }
              },
              300
            );
          });

          // Bouton d'itinéraire à l'intérieur du popup
          popupDOMElement.addEventListener('click', async (ev) => {
            const t = ev.target as HTMLElement;
            const trigger = t.closest('[trigger-popup=itineraire]') as HTMLElement | null;
            if (!trigger) return;

            ev.preventDefault();
            ev.stopPropagation();

            await performItineraryFromCard(map, element, trigger);
          });
        }
      });

      // Gestionnaire de clic sur la carte
      map.on('click', (e) => {
        if ((e.originalEvent.target as HTMLElement).getAttribute('aria-label') === 'Map') {
          clearAllPopupsAndMarkers();
        }
      });

      // Événements des marqueurs
      markerElement.addEventListener('click', () => {
        clearAllPopupsAndMarkers();
        popup.addTo(map);
        currentClickedItem = element;
        currentClickedItem.classList.add('active');
        currentClickedMarker = markerElement;
        currentClickedMarker.classList.add('show', 'active');
        isClickActive = true;
        flyToLocation(map, [lon, lat], 8);
      });

      markerElement.addEventListener('mouseenter', () => {
        clearElementTimeout(markerElement);
        if (isClickActive && currentClickedMarker === markerElement) {
          return;
        }
        popup.addTo(map);
        markerElement.classList.add('show');
      });

      markerElement.addEventListener('mouseleave', () => {
        if (isClickActive && currentClickedMarker === markerElement) {
          return;
        }
        setElementTimeout(
          markerElement,
          () => {
            if (currentClickedMarker !== markerElement || !isClickActive) {
              removePopupWithFade(popup);
              markerElement.classList.remove('show', 'active');
            }
          },
          300
        );
      });

      // Événements des éléments de liste
      element.addEventListener('click', async (ev) => {
        const targetEl = ev.target as HTMLElement;

        // Si clic sur un lien avec une vraie URL, on laisse naviguer
        const anchor = targetEl.closest('a') as HTMLAnchorElement | null;
        if (anchor) {
          const href = anchor.getAttribute('href')?.trim() || '';
          if (href && href !== '#') {
            return; // navigation autorisée
          }
        }

        // Bloquer la navigation par défaut (cartes, liens factices, etc.)
        ev.preventDefault();
        ev.stopPropagation();

        // Utiliser la fonction partagée pour garantir le même comportement
        // Route depuis la card (même flux que le bouton)
        await performItineraryFromCard(map, element, undefined);
      });

      // Désactivation du comportement au survol des cartes; interactions uniquement au clic
    });

    return map;
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la carte:", error);
    throw error;
  }
}
