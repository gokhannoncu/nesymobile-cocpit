/**
 * Starts HTMLMediaElement playback and swallows AbortError when pause() interrupts play().
 * @see https://developer.chrome.com/blog/play-request-was-interrupted
 */
export function playVideoElement(video: HTMLVideoElement): void {
  const playPromise = video.play();
  if (playPromise === undefined) return;

  void playPromise.catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    console.warn('[VideoPlayer] Failed to play video', error);
  });
}
