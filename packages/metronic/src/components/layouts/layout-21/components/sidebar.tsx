import { SidebarPrimary } from "./sidebar-primary";
import { SidebarSecondary } from "./sidebar-secondary";

export function Sidebar() {
  return (
    <aside className="fixed overflow-hidden top-0 bottom-0 start-0 z-20 transition-all duration-300 flex items-stretch flex-shrink-0 w-(--sidebar-width) in-data-[sidebar-open=false]:w-(--sidebar-collapsed-width) bg-background">
      <SidebarPrimary />
      <SidebarSecondary />
    </aside>
  );
}
