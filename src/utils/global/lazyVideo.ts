/**
 * Lazy Video — load & play videos only when visible in the viewport.
 *
 * Targets all <video> elements with the class `video-component`.
 * On init, the script moves each video's `src` into `data-src` to abort
 * any in-progress download. An IntersectionObserver then restores the src
 * and plays the video when it enters the viewport, and pauses it when it leaves.
 *
 * In Webflow: just add `data-lazy-video="unload"` on videos you want to
 * fully unload when off-screen (frees memory on heavy pages).
 */

const SELECTOR = 'video.video-component';
const ROOT_MARGIN = '200px';

export function initLazyVideo() {
  // Exclude hero slider videos — they're managed by the slider itself
  const allVideos = document.querySelectorAll<HTMLVideoElement>(SELECTOR);
  const videos = Array.from(allVideos).filter((v) => !v.closest('.swiper.is-home-hero'));
  if (!videos.length) return;

  // Step 1 — Strip src from every video to stop ongoing downloads.
  // Store the original src in data-src for later restoration.
  for (const video of videos) {
    const src = video.getAttribute('src');
    if (src) {
      video.setAttribute('data-src', src);
      video.removeAttribute('src');
      video.load(); // abort the current download
    }
  }

  // Step 2 — Observe visibility
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;

        if (entry.isIntersecting) {
          loadAndPlay(video);
        } else {
          pauseAndMaybeUnload(video);
        }
      }
    },
    { rootMargin: ROOT_MARGIN }
  );

  for (const video of videos) {
    observer.observe(video);
  }
}

function loadAndPlay(video: HTMLVideoElement) {
  const dataSrc = video.getAttribute('data-src');
  if (!dataSrc) return;

  // Only set src if it's not already loaded
  if (video.getAttribute('src') !== dataSrc) {
    video.src = dataSrc;
  }

  video.play().catch(() => {
    // Autoplay blocked by browser — silent fail
  });
}

function pauseAndMaybeUnload(video: HTMLVideoElement) {
  video.pause();

  // In "unload" mode, remove src to free memory & bandwidth
  if (video.getAttribute('data-lazy-video') === 'unload') {
    video.removeAttribute('src');
    video.load();
  }
}
