import { ScrollArea } from "@nesy/metronic/components/ui/scroll-area";
import { SidebarPrimaryMenu } from "./sidebar-primary-menu";
import { SidebarWorkspaceSections } from "./sidebar-workspace-sections";
import { SidebarSearch } from "./sidebar-search";
import { SidebarHeader } from "./sidebar-header";

export function SidebarSecondary() {
  return (
    <div className="lg:rounded-s-xl bg-background overflow-hidden border border-border">
      <SidebarHeader />
      <ScrollArea className="shrink-0 h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-5.5rem)] mt-0 mb-2.5">        
        <SidebarSearch />
        <SidebarPrimaryMenu />
        <SidebarWorkspaceSections />
      </ScrollArea>
    </div>
  );
}
