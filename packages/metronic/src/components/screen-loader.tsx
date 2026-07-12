'use client';

import { toAbsoluteUrl } from '@nesy/metronic/lib/helpers';

export function ScreenLoader() {
  return (
    <div className="flex flex-col items-center gap-2 justify-center fixed inset-0 z-50 transition-opacity duration-700 ease-in-out">
      <img
        className="h-[36px] max-w-none rounded-lg"
        src={toAbsoluteUrl('/media/app/nesy-icon.png')}
        alt="Nesy Mobile"
      />
      <div className="text-muted-foreground font-medium text-sm">
        Loading...
      </div>
    </div>
  );
}
