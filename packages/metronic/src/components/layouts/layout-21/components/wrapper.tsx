import { useLayout } from './context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { HeaderBreadcrumbs } from './header-breadcrumbs';
import { useEffect, useState } from 'react';
import { cn } from '@nesy/metronic/lib/utils';
import { NavigationFeedback } from './navigation-feedback';

export function Wrapper({ children }: { children: React.ReactNode }) {
  const {isMobile} = useLayout();
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEnableTransitions(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <NavigationFeedback />
      <Header />
      {!isMobile && <Sidebar />}

      <div data-slot="layout-content" className={cn(
        'bg-background lg:border-e lg:border-b lg:border-border grow min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-ee-xl lg:in-data-[sidebar-open=false]:rounded-es-xl lg:in-data-[sidebar-open=false]:border-s pt-(--header-height-mobile) lg:mb-(--page-margin) lg:me-(--page-margin) lg:pt-0 lg:mt-[calc(var(--header-height)+var(--page-margin))] lg:ms-(--sidebar-width) lg:in-data-[sidebar-open=false]:ms-(--sidebar-collapsed-width) duration-300',
        enableTransitions ? 'transition-all duration-300' : 'transition-none'
      )}>    
        <main className="grow min-w-0 py-5 lg:py-7.5" role="content">
          {isMobile && <HeaderBreadcrumbs />}
          {children}
        </main>
      </div>
    </>
  );
}
