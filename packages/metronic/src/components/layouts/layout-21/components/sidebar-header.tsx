import { PanelRight } from 'lucide-react';
import { useLayout } from './context';
import { toAbsoluteUrl } from '@nesy/metronic/lib/helpers';
import { Button } from '@nesy/metronic/components/ui/button';
import { cn } from '@nesy/metronic/lib/utils';

/** Nesy Mobile app icon (Android launcher asset). */
function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={toAbsoluteUrl('/media/app/nesy-icon.png')}
      alt="Nesy Mobile"
      className={cn('shrink-0 rounded-lg', className)}
    />
  );
}

// Brand logo — app icon + wordmark.
function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Nesy Mobile Cockpit">
      <BrandMark className="size-7" />
      <span className="text-[17px] font-bold tracking-[-0.035em] text-foreground">
        Nesy<span className="text-orange-500">Mobile</span>
      </span>
    </span>
  );
}

export function SidebarHeader() {
  const { sidebarToggle } = useLayout();

  return (
    <div className="flex border-b border-border items-center gap-2 h-[calc(var(--header-height)-1px)]">
      <div className="flex items-center w-full">
        {/* Sidebar header */}
        <div className="flex w-full grow items-center justify-between px-5 gap-2.5">
          <div className="px-1.5 -ms-1.5">
            <BrandLogo />
          </div>

          {/* Sidebar toggle */}
          <Button
            mode="icon"
            variant="ghost"
            onClick={sidebarToggle}
            className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
          >
            <PanelRight className="opacity-100" />
          </Button>
        </div>
      </div>
    </div>
  );
}
