import { MenuConfig, MenuItem, Workspace } from '@nesy/metronic/config/types';
import { WORKSPACES } from '@nesy/metronic/config/layout-21.config';

export interface BreadcrumbCrumb {
  title: string;
  path?: string;
}

/**
 * Verilen path'e (örn. "/core/model-architecture") karşılık gelen menü öğesini
 * bir menü ağacında özyinelemeli olarak arar.
 */
export function findMenuItemByPath(config: MenuConfig, path: string): MenuItem | undefined {
  for (const item of config) {
    if (item.path === path) {
      return item;
    }
    if (item.children) {
      const found = findMenuItemByPath(item.children, path);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Tüm workspace menülerinde verilen path'e karşılık gelen öğeyi arar.
 * Workspace kök route'ları (/modules, /design vb.) menüde ayrı bir öğe olarak
 * bulunmadığından, onlar için grup başlığından sentetik bir öğe üretilir.
 * Dinamik placeholder sayfası ([...slug]) başlık + notionUrl için bunu kullanır.
 */
export function findWorkspaceMenuItem(path: string): MenuItem | undefined {
  for (const ws of WORKSPACES) {
    if (ws.path === path) {
      const group = ws.menu[0];
      return {
        title: group?.title ?? ws.label,
        path: ws.path,
        notionUrl: group?.notionUrl,
      };
    }
    const found = findMenuItemByPath(ws.menu, path);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Aktif pathname'e göre hangi workspace'in seçili olduğunu döndürür.
 * Eşleşme yoksa ilk workspace'e (Home) düşer.
 */
export function getActiveWorkspace(pathname: string): Workspace {
  for (const ws of WORKSPACES) {
    for (const base of ws.basePaths) {
      const matches =
        base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(base + '/');
      if (matches) {
        return ws;
      }
    }
  }
  return WORKSPACES[0]!;
}

function findMenuChain(
  items: MenuConfig,
  path: string,
  ancestors: MenuItem[],
): MenuItem[] | null {
  for (const item of items) {
    if (item.path === path) {
      return [...ancestors, item];
    }

    if (item.children?.length) {
      const found = findMenuChain(item.children, path, [...ancestors, item]);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function toBreadcrumbCrumb(
  item: MenuItem,
  index: number,
  chain: MenuItem[],
  workspace: Workspace,
): BreadcrumbCrumb {
  const isLast = index === chain.length - 1;

  if (isLast) {
    return { title: item.title ?? workspace.label };
  }

  if (item.path) {
    return { title: item.title!, path: item.path };
  }

  if (index === 0) {
    return { title: item.title ?? workspace.label, path: workspace.path };
  }

  return { title: item.title! };
}

/**
 * Aktif pathname için breadcrumb zincirini workspace menüsünden üretir.
 */
export function getBreadcrumbs(pathname: string): BreadcrumbCrumb[] {
  const workspace = getActiveWorkspace(pathname);

  for (const group of workspace.menu) {
    if (!group.children?.length) {
      continue;
    }

    const ancestors = group.title ? [group] : [];
    const chain = findMenuChain(group.children, pathname, ancestors);

    if (chain) {
      return chain.map((item, index) => toBreadcrumbCrumb(item, index, chain, workspace));
    }
  }

  if (pathname === workspace.path) {
    const group = workspace.menu[0];
    return [{ title: group?.title ?? workspace.label }];
  }

  if (pathname === '/') {
    return [{ title: 'Executive Overview' }];
  }

  return [{ title: workspace.label }];
}

/** Toplu PDF export için düzleştirilmiş sayfa referansı. */
export interface WorkspacePageRef {
  path: string;
  title: string;
}

/**
 * Bir workspace'in menü ağacını sidebar sırasıyla düz bir sayfa listesine çevirir.
 * Yalnızca path'i olan, disabled olmayan ve workspace'in basePaths kapsamındaki
 * öğeler alınır (workspace dışına / harici linkler elenir). İlk görülme sırası
 * korunur ve tekrar eden path'ler ayıklanır (overview hem ws.path hem menü
 * öğesi olarak geçebildiğinden dedupe şarttır).
 */
export function getWorkspacePages(ws: Workspace): WorkspacePageRef[] {
  const seen = new Set<string>();
  const out: WorkspacePageRef[] = [];

  const inScope = (p: string) =>
    ws.basePaths.some((base) => p === base || p.startsWith(base + '/'));

  const walk = (items: MenuConfig) => {
    for (const item of items) {
      if (item.path && !item.disabled && inScope(item.path) && !seen.has(item.path)) {
        seen.add(item.path);
        out.push({ path: item.path, title: item.title ?? item.path });
      }
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };

  walk(ws.menu);
  return out;
}
