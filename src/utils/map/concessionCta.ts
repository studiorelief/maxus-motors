/**
 * ============================================================================
 * CONCESSION CTA → CONCESSIONS PAGE HANDOFF
 * ============================================================================
 *
 * Purpose
 * - Provide autocomplete (city and postal code) on pages that are NOT the map
 * - Persist user intent (address or geolocate) to localStorage
 * - Navigate to /concessions where the map consumes the intent and runs search
 *
 * Selectors (required in DOM where this module runs)
 * - #concession-cta-input           → Text input (city or postal code)
 * - #concession-cta-search          → Button to validate the input and navigate
 * - #concession-cta-localization    → Button to request geolocation flow
 *
 * Integration contract with map.ts
 * - This module writes `localStorage.concessionIntent` with one of:
 *   { type: 'address', address: string }
 *   { type: 'geolocate' }
 * - map.ts reads the value on /concessions and:
 *   - For address: dispatches `window` event 'concession-intent-address' with detail { address }
 *   - For geolocate: clicks the map geolocation button
 *
 * Styling hooks
 * - .address-suggestions (container)
 * - .address-suggestion  (item)
 * - .address-suggestion.selected (hover/keyboard highlight)
 */

const CTA_SELECTORS = {
  wrapper: '.section_concession-cta',
  input: '#concession-cta-input',
  searchButton: '#concession-cta-search',
  geolocateButton: '#concession-cta-localization',
} as const;

// Mapbox token (keep in sync with map.ts)
const MAPBOX_ACCESS_TOKEN =
  'pk.eyJ1Ijoic3R1ZGlvLXJlbGllZiIsImEiOiJjbWZuczN3dmswNXpxMmtxd2VwNmtuODhmIn0.yWb8YSp3FSuOSCrB3pWtxQ';

type AddressSuggestion = { id: string; place_name: string; center: [number, number]; text: string };

/**
 * Create the floating suggestions dropdown aligned to the input
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
 * Render suggestions list with click/hover behavior
 */
function displaySuggestions(
  suggestions: AddressSuggestion[],
  container: HTMLElement,
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
      container
        .querySelectorAll('.address-suggestion')
        .forEach((el) => el.classList.remove('selected'));
      suggestionElement.classList.add('selected');
    });

    container.appendChild(suggestionElement);
  });

  container.style.display = 'block';
}

/** Hide suggestions container */
function hideSuggestions(): void {
  const container = document.querySelector('.address-suggestions') as HTMLElement;
  if (container) container.style.display = 'none';
}

/**
 * Fetch address suggestions from Mapbox Geocoding API
 * - Supports both city names and postal codes
 */
async function getAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const isPostalCode = /^\d{2,5}$/.test(cleanQuery);
  let types = 'place,locality,neighborhood,address';
  if (isPostalCode) types = 'postcode,place,locality,address';

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    cleanQuery
  )}.json?country=fr&access_token=${MAPBOX_ACCESS_TOKEN}&limit=5&types=${types}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
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
  } catch {
    return [];
  }
}

/**
 * Wire up autocomplete behavior on the CTA input (debounced search, keyboard nav)
 * - Enter with a selected suggestion triggers navigation
 * - Plain Enter clicks the CTA search button (when available)
 */
function setupAddressAutocomplete(input: HTMLInputElement, searchBtn: HTMLElement | null): void {
  input.setAttribute('autocomplete', 'off');

  let suggestionsContainer: HTMLElement | null = null;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedIndex = -1;
  let currentSuggestions: AddressSuggestion[] = [];

  const updateSelectedSuggestion = (): void => {
    if (!suggestionsContainer) return;
    const suggestionElements = suggestionsContainer.querySelectorAll('.address-suggestion');
    suggestionElements.forEach((el, index) =>
      el.classList.toggle('selected', index === selectedIndex)
    );
  };

  /** Persist address intent and navigate to /concessions */
  const performSearch = (address: string): void => {
    if (!address.trim()) return;
    localStorage.setItem('concessionIntent', JSON.stringify({ type: 'address', address }));
    navigateToConcessions();
  };

  const searchSuggestions = async (query: string): Promise<void> => {
    if (query.length < 2) {
      hideSuggestions();
      return;
    }

    try {
      const suggestions = await getAddressSuggestions(query);
      currentSuggestions = suggestions;
      selectedIndex = -1;

      if (!suggestionsContainer) suggestionsContainer = createSuggestionsContainer(input);
      displaySuggestions(suggestions, suggestionsContainer, (suggestion) =>
        performSearch(suggestion.place_name)
      );
    } catch {
      // ignore
    }
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => searchSuggestions(query), 300);
  });

  input.addEventListener('keydown', (event) => {
    if (!suggestionsContainer || currentSuggestions.length === 0) return;
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
          performSearch(suggestion.place_name);
        } else if (searchBtn) {
          searchBtn.click();
        }
        break;
      case 'Escape':
        hideSuggestions();
        break;
    }
  });

  document.addEventListener('click', (event) => {
    if (
      !input.contains(event.target as Node) &&
      !suggestionsContainer?.contains(event.target as Node)
    ) {
      hideSuggestions();
    }
  });
}

function navigateToConcessions(): void {
  const target = '/concessions#scroll';
  if (window.location.pathname === target) {
    // If already on the page, reload to ensure map init runs and consumes intent
    window.location.reload();
  } else {
    window.location.assign(target);
  }
}

/**
 * Initialize CTA bindings on non-map pages
 */
export function initConcessionCta(): void {
  try {
    const wrapper = document.querySelector(CTA_SELECTORS.wrapper);
    if (!wrapper) return;

    const input = document.querySelector(CTA_SELECTORS.input) as HTMLInputElement | null;
    const searchBtn = document.querySelector(CTA_SELECTORS.searchButton) as HTMLElement | null;
    const geoBtn = document.querySelector(CTA_SELECTORS.geolocateButton) as HTMLElement | null;

    if (input) setupAddressAutocomplete(input, searchBtn);

    // Search by address/city/postal code
    if (searchBtn && input) {
      searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const address = (input.value || '').trim();
        if (!address) return;

        localStorage.setItem('concessionIntent', JSON.stringify({ type: 'address', address }));
        navigateToConcessions();
      });

      // Also support Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchBtn.click();
        }
      });
    }

    // Geolocation intent
    if (geoBtn) {
      geoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('concessionIntent', JSON.stringify({ type: 'geolocate' }));
        navigateToConcessions();
      });
    }
  } catch {
    // Silent fail to avoid breaking other pages
  }
}
