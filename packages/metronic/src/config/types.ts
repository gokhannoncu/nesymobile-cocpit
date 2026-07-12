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
}

export type MenuConfig = MenuItem[];

// Sol ikon rayındaki (SidebarPrimary) workspace'ler. Her workspace kendi
// ikonuna, rengine, kök route'una ve ikincil menüsüne (SidebarPrimaryMenu) sahiptir.
export interface Workspace {
  id: string;
  label: string;
  icon: LucideIcon;
  className: string; // ikon butonunun renk sınıfları
  path: string; // ikona tıklanınca gidilecek kök route
  basePaths: string[]; // bu workspace'in sahip olduğu URL önekleri (aktiflik tespiti)
  menu: MenuConfig; // workspace aktifken gösterilen ikincil menü
}
