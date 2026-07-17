import { afterEach, describe, expect, it, vi } from 'vitest';
import { playVideoElement } from './safe-video-play';

describe('playVideoElement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores AbortError from interrupted play()', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const abortError = new DOMException(
      'The play() request was interrupted by a call to pause().',
      'AbortError',
    );

    const video = {
      play: vi.fn().mockRejectedValue(abortError),
    } as unknown as HTMLVideoElement;

    playVideoElement(video);

    await Promise.resolve();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs unexpected play() failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notAllowed = new DOMException('Not allowed', 'NotAllowedError');

    const video = {
      play: vi.fn().mockRejectedValue(notAllowed),
    } as unknown as HTMLVideoElement;

    playVideoElement(video);

    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
