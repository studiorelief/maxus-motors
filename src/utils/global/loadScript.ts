export default function loadScript(
  src: string,
  attributes?: string | string[] | boolean,
  module?: boolean
) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');

    script.src = src;
    script.async = true;

    // Définir le type de script selon le paramètre module
    if (module !== false) {
      script.type = 'module';
    }

    // Ajouter les attributs selon le paramètre
    if (attributes) {
      if (typeof attributes === 'string') {
        // Si c'est une string, utiliser le nom de l'attribut fourni
        script.setAttribute(attributes, '');
      } else if (Array.isArray(attributes)) {
        // Si c'est un tableau, ajouter tous les attributs
        attributes.forEach((attr) => {
          script.setAttribute(attr, '');
        });
      } else if (attributes === true) {
        // Si c'est true, utiliser fs-list par défaut (rétrocompatibilité)
        script.setAttribute('fs-list', '');
      }
    }

    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.head.appendChild(script);
  });
}

export function loadAttributesScripts() {
  // Finsweet Libraries
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-accordion@1/accordion.js');
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-selectcustom@1/selectcustom.js');
  //   loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsselect@1/cmsselect.js');
  //   loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes-inputactive@1/inputactive.js');
  // Finsweet Attributes V2
  loadScript('https://cdn.jsdelivr.net/npm/@finsweet/attributes@2/attributes.js', [
    'fs-list',
    // 'fs-readtime',
    // 'fs-toc',
    // 'fs-inject',
    'fs-socialshare',
    'fs-formsubmit',
  ]);
  // FlowPlay+ - Video
  //   loadScript(
  //     'https://cdn.jsdelivr.net/gh/videsigns/webflow-tools@latest/Media%20Player/flowplayplus.js',
  //     undefined,
  //     false
  //   );
}
