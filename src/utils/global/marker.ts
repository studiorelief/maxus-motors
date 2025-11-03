/*
 *============================================================================
 * SCRIPT RECETTAGE
 *============================================================================
 */

import markerSDK from '@marker.io/browser';
export async function initMarker() {
  // Only load marker if URL contains 'webflow'
  if (window.location.href.includes('webflow')) {
    await markerSDK.loadWidget({
      project: '68dd2d089b0f1046dec4849e',
    });
  }
}
