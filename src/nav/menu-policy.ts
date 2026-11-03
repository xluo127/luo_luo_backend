export interface PolicyMenu {
  id: number;
  parentId: number | null;
  visible: boolean;
  url: string | null;
}

export function visibleMenus<Menu extends PolicyMenu>(menus: Menu[]): Menu[] {
  const nodes = new Map(menus.map((menu) => [menu.id, menu]));
  return menus.filter((menu) => {
    let current: PolicyMenu | undefined = menu;
    const visited = new Set<number>();
    while (current) {
      if (!current.visible || visited.has(current.id)) return false;
      visited.add(current.id);
      if (current.parentId === null) return true;
      current = nodes.get(current.parentId);
    }
    return false;
  });
}

export function authorizedMenuTree<Menu extends PolicyMenu>(
  menus: Menu[],
  menuIds: number[],
  isAdmin: boolean,
) {
  const effective = visibleMenus(menus);
  const granted = new Set(menuIds);
  const available = new Map(effective.map((menu) => [menu.id, menu]));
  const included = new Set<number>();
  for (const menu of effective) {
    if (!isAdmin && !granted.has(menu.id)) continue;
    let current: Menu | undefined = menu;
    while (current && !included.has(current.id)) {
      included.add(current.id);
      current =
        current.parentId === null ? undefined : available.get(current.parentId);
    }
  }
  type Tree = Menu & { clickable: boolean; children: Tree[] };
  const nodes = new Map<number, Tree>();
  for (const menu of effective) {
    if (!included.has(menu.id)) continue;
    const clickable = (isAdmin || granted.has(menu.id)) && Boolean(menu.url);
    nodes.set(menu.id, {
      ...menu,
      url: clickable ? menu.url : null,
      clickable,
      children: [],
    });
  }
  const roots: Tree[] = [];
  for (const menu of nodes.values()) {
    if (menu.parentId === null) roots.push(menu);
    else nodes.get(menu.parentId)?.children.push(menu);
  }
  return roots;
}

export function learningScope(url: string | null): string | null | undefined {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return undefined;
  const parsed = new URL(url, 'http://internal.local');
  if (parsed.pathname !== '/learning') return undefined;
  return parsed.searchParams.get('category') || null;
}
