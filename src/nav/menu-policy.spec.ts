import {
  authorizedMenuTree,
  learningScope,
  visibleMenus,
} from './menu-policy.js';

const menus = [
  { id: 1, parentId: null, visible: true, url: '/learning' },
  { id: 2, parentId: 1, visible: true, url: '/learning?category=frontend' },
  { id: 3, parentId: 2, visible: true, url: '/learning?category=javascript' },
  { id: 4, parentId: 2, visible: true, url: '/learning?category=css' },
  { id: 5, parentId: 1, visible: false, url: '/learning?category=backend' },
  { id: 6, parentId: 5, visible: true, url: '/learning?category=nestjs' },
];

describe('menu policy', () => {
  it('returns no menu for an unassigned user', () => {
    expect(authorizedMenuTree(menus, [], false)).toEqual([]);
  });
  it('retains ancestors as directories without granting siblings', () => {
    const tree = authorizedMenuTree(menus, [3], false);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: 1, clickable: false, url: null });
    expect(tree[0].children[0]).toMatchObject({
      id: 2,
      clickable: false,
      url: null,
    });
    expect(tree[0].children[0].children.map((menu) => menu.id)).toEqual([3]);
    expect(tree[0].children[0].children[0].clickable).toBe(true);
  });
  it('does not grant child menus when only the parent is assigned', () => {
    expect(authorizedMenuTree(menus, [1], false)[0].children).toEqual([]);
  });
  it('excludes hidden branches even with assigned descendants', () => {
    expect(authorizedMenuTree(menus, [6], false)).toEqual([]);
    expect(visibleMenus(menus).map((menu) => menu.id)).toEqual([1, 2, 3, 4]);
  });
  it('handles malformed cycles without hanging', () => {
    expect(visibleMenus([{ ...menus[0], parentId: 1 }])).toEqual([]);
  });
  it('only recognizes implemented internal learning addresses', () => {
    expect(learningScope('/learning')).toBeNull();
    expect(learningScope('/learning?category=javascript')).toBe('javascript');
    expect(learningScope('https://example.com/learning')).toBeUndefined();
    expect(learningScope('//example.com/learning')).toBeUndefined();
    expect(learningScope('/learning-other')).toBeUndefined();
  });
});
