/* eslint-disable */

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Type d'énergie du véhicule
 */
type VehicleType =
  | 'utilitaire thermique'
  | 'utilitaire électrique'
  | 'pickup thermique'
  | 'pickup électrique';

/**
 * Données d'un véhicule pour le comparateur
 */
interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  charge: number; // en kg
  volume?: number; // en m³
  longueur?: number; // en m
  disabled?: boolean; // true = mis en stand by, exclu du comparateur
}

/**
 * Critères de recherche de l'utilisateur
 */
interface SearchCriteria {
  type: VehicleType | null;
  charge: number | null;
  volume: number | null;
  longueur: number | null;
}

// ============================================================================
// BASE DE DONNÉES DES VÉHICULES
// ============================================================================

/**
 * Base de données des véhicules avec leurs spécifications
 */
const VEHICLES: Vehicle[] = [
  // Thermiques
  {
    id: 'deliver7',
    name: 'Deliver 7',
    type: 'utilitaire thermique',
    charge: 1229, // kg
    volume: 7.2, // m³
    longueur: 2.8, // m /* ! TODO: Vérifier la longueur */
  },
  {
    id: 'deliver9',
    name: 'Deliver 9',
    type: 'utilitaire thermique',
    charge: 1450, // kg
    volume: 11.5, // m³
    longueur: 3.413, // m
  },
  {
    id: 't60max',
    name: 'T60 Max',
    type: 'pickup thermique',
    charge: 1000, // kg
    volume: 0,
    longueur: 0, // m
  },

  // Électriques
  {
    id: 'edeliver3',
    name: 'eDeliver 3',
    type: 'utilitaire électrique',
    charge: 1080, // kg
    volume: 6.3, // m³ (max)
    longueur: 2.77, // m
    disabled: true, // Stand by : passer à false pour réactiver
  },
  {
    id: 'edeliver5',
    name: 'eDeliver 5',
    type: 'utilitaire électrique',
    charge: 1265, // kg
    volume: 8.7, // m³
    longueur: 0, // m
  },
  {
    id: 'edeliver7',
    name: 'eDeliver 7',
    type: 'utilitaire électrique',
    charge: 1200, // Non spécifié dans l'image
    volume: 8.7, // m³
    longueur: 0, // m
  },
  {
    id: 'edeliver9',
    name: 'eDeliver 9',
    type: 'utilitaire électrique',
    charge: 1040, // kg
    volume: 12.33, // m³
    longueur: 0, // m
    disabled: true, // Stand by : passer à false pour réactiver
  },
  {
    id: 'eterron9',
    name: 'eTerron 9',
    type: 'pickup électrique',
    charge: 650, // kg
    volume: 0,
    longueur: 0, // m
  },
  {
    id: 't90ev',
    name: 'T90 EV',
    type: 'pickup électrique',
    charge: 1000, // Non spécifié clairement dans l'image
    volume: 0,
    longueur: 0, // m
    disabled: true, // Stand by : passer à false pour réactiver
  },
];

/**
 * Véhicules actifs (hors stand by) — c'est cette liste qu'utilise le comparateur
 */
const ACTIVE_VEHICLES: Vehicle[] = VEHICLES.filter((vehicle) => !vehicle.disabled);

// ============================================================================
// ALGORITHME DE COMPARAISON
// ============================================================================

/**
 * Calcule le score d'un véhicule par rapport aux critères de recherche
 * @param vehicle Véhicule à évaluer
 * @param criteria Critères de recherche
 * @returns Score de correspondance (plus petit = meilleur match)
 */
function calculateScore(vehicle: Vehicle, criteria: SearchCriteria): number | null {
  let totalScore = 0;
  let criteriaCount = 0;

  // Type (obligatoire)
  if (!criteria.type) return null;
  if (vehicle.type !== criteria.type) return null; // Exclure si le type ne correspond pas

  // Charge
  if (criteria.charge !== null && vehicle.charge > 0) {
    const diff = Math.abs(vehicle.charge - criteria.charge);
    // Normaliser le score en divisant par 100 pour avoir un poids raisonnable
    totalScore += diff / 100;
    criteriaCount += 1;
  }

  // Volume
  if (criteria.volume !== null && vehicle.volume && vehicle.volume > 0) {
    const diff = Math.abs(vehicle.volume - criteria.volume);
    totalScore += diff * 10; // Multiplier par 10 car les volumes sont en m³
    criteriaCount += 1;
  }

  // Longueur
  if (criteria.longueur !== null && vehicle.longueur && vehicle.longueur > 0) {
    const diff = Math.abs(vehicle.longueur - criteria.longueur);
    totalScore += diff * 100; // Multiplier par 100 car les longueurs sont en m
    criteriaCount += 1;
  }

  // Si aucun critère numérique n'a été évalué, exclure ce véhicule
  if (criteriaCount === 0) return null;

  // Retourner le score moyen
  return totalScore / criteriaCount;
}

/**
 * Trouve le véhicule qui correspond le mieux aux critères
 * @param criteria Critères de recherche
 * @returns Véhicule sélectionné ou null si aucun match
 */
function findBestMatch(criteria: SearchCriteria): Vehicle | null {
  // Vérifier que le type est défini
  if (!criteria.type) return null;

  let bestVehicle: Vehicle | null = null;
  let bestScore: number | null = null;

  for (const vehicle of ACTIVE_VEHICLES) {
    const score = calculateScore(vehicle, criteria);

    if (score !== null) {
      if (bestScore === null || score < bestScore) {
        bestScore = score;
        bestVehicle = vehicle;
      }
    }
  }

  return bestVehicle;
}

/**
 * Récupère les valeurs des dropdowns du formulaire
 * @returns Critères de recherche basés sur les sélections
 */
function getSearchCriteria(): SearchCriteria {
  const typeSelect = document.querySelector('[name-comparateur="type"]') as HTMLElement;
  const chargeSelect = document.querySelector('[name-comparateur="charge"]') as HTMLElement;
  const volumeSelect = document.querySelector('[name-comparateur="volume"]') as HTMLElement;
  const longueurSelect = document.querySelector('[name-comparateur="longueur"]') as HTMLElement;

  // Extraire la valeur du type (utilitaire/pickup + thermique/électrique)
  const getType = (): VehicleType | null => {
    if (!typeSelect?.textContent) return null;
    const value = typeSelect.textContent.toLowerCase().trim();

    console.log('Raw type value:', typeSelect.textContent, '-> Normalized:', value);

    // Détecter la catégorie (utilitaire ou pickup)
    const isUtilitaire = value.includes('utilitaire');
    const isPickup = value.includes('pickup');

    // Détecter l'énergie (thermique ou électrique)
    const isThermique = value.includes('thermi');
    const isElectrique =
      value.includes('électrique') || value.includes('electrique') || value.includes('elec');

    // Construire le type complet
    if (isUtilitaire && isThermique) return 'utilitaire thermique';
    if (isUtilitaire && isElectrique) return 'utilitaire électrique';
    if (isPickup && isThermique) return 'pickup thermique';
    if (isPickup && isElectrique) return 'pickup électrique';

    return null;
  };

  // Extraire un nombre d'une chaîne comme "Jusqu'à 1000 kg"
  const extractNumber = (text: string): number | null => {
    const match = text.match(/\d+[\s,.]?\d*/);
    if (!match) return null;
    return parseFloat(match[0].replace(/[\s,]/g, ''));
  };

  const criteria: SearchCriteria = {
    type: getType(),
    charge: chargeSelect?.textContent ? extractNumber(chargeSelect.textContent) : null,
    volume: volumeSelect?.textContent ? extractNumber(volumeSelect.textContent) : null,
    longueur: longueurSelect?.textContent ? extractNumber(longueurSelect.textContent) : null,
  };

  return criteria;
}

// ============================================================================
// LOGIQUE DU COMPARATEUR
// ============================================================================

/**
 * Logique du comparateur avec animations entre les étapes
 */
export function comparateurLogic(): void {
  // Sélectionner les éléments des étapes
  const step1 = document.querySelector('.comparateur_step-1') as HTMLElement;
  const step2 = document.querySelector('.comparateur_step-2') as HTMLElement;
  const step3 = document.querySelector('.comparateur_step-3') as HTMLElement;
  const step3Bg = document.querySelector('.comparateur_step-3_background') as HTMLElement | null;
  const step3Content = document.querySelector('.comparateur_step-3_content') as HTMLElement | null;

  if (!step1 || !step2 || !step3) {
    // console.warn('Éléments des étapes du comparateur non trouvés');
    return;
  }

  // Préparer step-2 (position initiale cachée)
  step2.style.transform = 'translateY(-4rem)';
  step2.style.opacity = '0';
  step2.style.display = 'none';

  // Préparer step-3 (position initiale cachée)
  step3.style.transform = 'translateY(-4rem)';
  step3.style.opacity = '0';
  step3.style.display = 'none';

  // Préparer les éléments internes de la step-3
  if (step3Bg) {
    step3Bg.style.opacity = '0';
  }
  if (step3Content) {
    step3Content.style.transform = 'translateY(4rem)';
    step3Content.style.opacity = '0';
  }

  // === TRANSITION STEP-1 -> STEP-2 ===
  const triggerStep1 = document.querySelector('[trigger="step-1"]');

  if (triggerStep1) {
    triggerStep1.addEventListener('click', () => {
      // Animation de sortie pour step-1
      step1.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
      step1.style.transform = 'translateY(4rem)';
      step1.style.opacity = '0';

      // Après l'animation de sortie, masquer step-1 et préparer step-2
      setTimeout(() => {
        step1.style.display = 'none';

        // Afficher step-2 et démarrer son animation d'entrée
        step2.style.display = 'flex';

        // S'assurer que l'état initial (hors écran) est bien pris en compte
        // avant d'appliquer la transition
        void step2.offsetHeight; // force reflow

        // Appliquer la transition à la frame suivante pour garantir l'animation
        requestAnimationFrame(() => {
          step2.style.transition = 'transform 0.6s ease-in-out, opacity 0.6s ease-in-out';
          step2.style.transform = 'translateY(0rem)';
          step2.style.opacity = '1';
        });
      }, 600); // Délai correspondant à la durée de l'animation
    });
  }

  // === TRANSITION STEP-2 -> STEP-3 ===
  const triggerStep2 = document.querySelector('[trigger="step-2"]');

  if (triggerStep2) {
    triggerStep2.addEventListener('click', () => {
      // Récupérer les critères de recherche
      const criteria = getSearchCriteria();

      // Debug: afficher les critères récupérés
      console.log('=== CRITÈRES RÉCUPÉRÉS ===');
      console.log('Type:', criteria.type);
      console.log('Charge:', criteria.charge);
      console.log('Volume:', criteria.volume);
      console.log('Longueur:', criteria.longueur);

      // Debug: afficher les scores de tous les véhicules
      console.log('=== SCORES DES VÉHICULES ===');
      for (const vehicle of ACTIVE_VEHICLES) {
        const score = calculateScore(vehicle, criteria);
        console.log(
          `${vehicle.name}: ${score !== null ? score.toFixed(2) : 'N/A'} (charge: ${vehicle.charge}, volume: ${vehicle.volume}, longueur: ${vehicle.longueur})`
        );
      }

      // Trouver le meilleur match
      const bestVehicle = findBestMatch(criteria);

      if (bestVehicle) {
        console.log(`🏆 VÉHICULE SÉLECTIONNÉ: ${bestVehicle.name}`);

        // Cacher tous les contenus de véhicules
        for (const vehicle of ACTIVE_VEHICLES) {
          const vehicleContent = document.querySelector(
            `.comparateur_step-3_content.is-${vehicle.id}`
          ) as HTMLElement;
          if (vehicleContent) {
            vehicleContent.style.display = 'none';
          }
        }

        // Afficher le véhicule sélectionné
        const selectedVehicle = document.querySelector(
          `.comparateur_step-3_content.is-${bestVehicle.id}`
        ) as HTMLElement;
        if (selectedVehicle) {
          selectedVehicle.style.display = 'flex';
        }
      } else {
        console.log('❌ Aucun véhicule trouvé');
      }

      // Animation de sortie pour step-2
      step2.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
      step2.style.transform = 'translateY(4rem)';
      step2.style.opacity = '0';

      // Après l'animation de sortie, masquer step-2 et préparer step-3
      setTimeout(() => {
        step2.style.display = 'none';

        // Afficher step-3 et démarrer son animation d'entrée
        step3.style.display = 'flex';

        // Réinitialiser explicitement les états initiaux des éléments internes
        if (step3Bg) {
          step3Bg.style.transition = '';
          step3Bg.style.opacity = '0';
        }
        if (step3Content) {
          step3Content.style.transition = '';
          step3Content.style.transform = 'translateY(8rem)';
          step3Content.style.opacity = '0';
        }

        // Forcer le reflow pour s'assurer que les styles initiaux sont pris en compte
        void step3.offsetHeight;
        if (step3Bg) void step3Bg.offsetHeight;
        if (step3Content) void step3Content.offsetHeight;

        // Animation d'entrée pour step-3
        step3.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
        step3.style.transform = 'translateY(0rem)';
        step3.style.opacity = '1';

        // Animer le background de la step-3
        if (step3Bg) {
          step3Bg.style.transition = 'opacity 0.6s ease-in-out';
          step3Bg.style.opacity = '1';
        }

        // Animer le contenu de la step-3
        if (step3Content) {
          step3Content.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
          step3Content.style.transform = 'translateY(0rem)';
          step3Content.style.opacity = '1';
        }
      }, 300); // Délai correspondant à la durée de l'animation
    });
  }
}
