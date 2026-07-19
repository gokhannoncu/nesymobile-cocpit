import { MenuConfig, MenuItem, Workspace } from '@nesy/metronic/config/types';
import { WORKSPACES } from '@nesy/metronic/config/layout-21.config';

export interface BreadcrumbCrumb {
  title: string;
  path?: string;
}

/**
 * Recursively searches a menu tree for the menu item matching the given path
 * (e.g. "/core/model-architecture").
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
 * Searches all workspace menus for the item matching the given path.
 * Prefer a real menu item when the workspace landing path is also a leaf
 * (e.g. Product → /product/domain-glossary → "Domain Glossary").
 * Only synthesize from the group title when the root route is not in the menu.
 * The dynamic placeholder page ([...slug]) uses this for title + notionUrl.
 */
export function findWorkspaceMenuItem(path: string): MenuItem | undefined {
  for (const ws of WORKSPACES) {
    const found = findMenuItemByPath(ws.menu, path);
    if (found) {
      return found;
    }
    if (ws.path === path) {
      const group = ws.menu[0];
      return {
        title: group?.title ?? ws.label,
        path: ws.path,
        notionUrl: group?.notionUrl,
      };
    }
  }
  return undefined;
}

/**
 * Returns the active workspace based on the current pathname.
 * Falls back to the first workspace (Home) if no match is found.
 */
export function getActiveWorkspace(pathname: string): Workspace {
  let bestMatch: { workspace: Workspace; baseLength: number } | null = null

  for (const ws of WORKSPACES) {
    for (const base of ws.basePaths) {
      const matches =
        base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(base + '/')
      if (!matches) continue

      const baseLength = base === '/' ? 1 : base.length
      if (!bestMatch || baseLength > bestMatch.baseLength) {
        bestMatch = { workspace: ws, baseLength }
      }
    }
  }

  return bestMatch?.workspace ?? WORKSPACES[0]!
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
 * Generates the breadcrumb chain for the active pathname from the workspace menu.
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

/** Flattened page reference used for bulk PDF export. */
export interface WorkspacePageRef {
  path: string;
  title: string;
}

/**
 * Flattens a workspace's menu tree into a page list in sidebar order.
 * Only items that have a path, are not disabled, and fall within the workspace's
 * basePaths are included (external links and out-of-scope items are filtered out).
 * Insertion order is preserved and duplicate paths are deduplicated (necessary
 * because overview can appear as both ws.path and a separate menu item).
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
