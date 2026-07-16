import { type LucideIcon } from 'lucide-react';

export interface MenuItem {
  title?: string;
  desc?: string;
  img?: string;
  icon?: LucideIcon;
  path?: string;
  notionUrl?: string;
  rootPath?: string;
  childrenIndex?: number;
  heading?: string;
  children?: MenuConfig;
  disabled?: boolean;
  collapse?: boolean;
  collapseTitle?: string;
  expandTitle?: string;
  badge?: string;
  separator?: boolean;
  /** When true, sidebar link stays disabled until Nesy dashboard auth is connected. */
  requiresNesyAuth?: boolean;
}

export type MenuConfig = MenuItem[];

// Workspaces in the left icon rail (SidebarPrimary). Each workspace has its own
// icon, color, root route, and secondary menu (SidebarPrimaryMenu).
export interface Workspace {
  id: string;
  label: string;
  icon: LucideIcon;
  className: string; // color classes for the icon button
  path: string; // root route to navigate to when the icon is clicked
  basePaths: string[]; // URL prefixes owned by this workspace (used for active state detection)
  menu: MenuConfig; // secondary menu displayed when this workspace is active
}
