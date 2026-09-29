"use client";
/**
 * TenantMenuProvider + useTenantMenu hook
 * Phase 5 C11: DOC-000088 S13 ΓÇö Frontend Dynamic Rendering Rules
 * Calls GET /tenant-config-engine/resolved-menu (NOT raw menu-tree).
 * The API applies the full S6.1 algorithm: capability + plan + role filtering.
 * Provides computed menu tree to all child components.
 * Adyaya Solutions Private Limited
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

export interface ResolvedMenuItem {
  id: string;
  menuCode: string;
  parentMenuCode: string | null;
  moduleCode: string;
  displayName: string;
  originalName: string;
  labelOverride: string | null;
  displayOrder: number;
  icon: string | null;
  routePath: string | null;
  isSection: boolean;
  capabilityDependency: string | null;
  children: ResolvedMenuItem[];
}

interface MenuContextValue {
  menuTree: ResolvedMenuItem[];
  flatMenus: ResolvedMenuItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getMenuByCode: (code: string) => ResolvedMenuItem | undefined;
  getModuleMenus: (moduleCode: string) => ResolvedMenuItem[];
  getLabel: (menuCode: string) => string;
}

const MenuContext = createContext<MenuContextValue>({
  menuTree: [], flatMenus: [], loading: true, error: null,
  refresh: async () => {}, getMenuByCode: () => undefined,
  getModuleMenus: () => [], getLabel: (code) => code,
});

export function TenantMenuProvider({ tenantId, userRole, planCode, children }: {
  tenantId: string; userRole: string; planCode: string; children: React.ReactNode;
}) {
  const [menuTree, setMenuTree] = useState<ResolvedMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/tenant-config-engine/resolved-menu?role=${encodeURIComponent(userRole)}&plan=${encodeURIComponent(planCode)}`,
        { headers: { "x-tenant-id": tenantId, "Content-Type": "application/json" } },
      );
      if (!res.ok) { setError(`Menu fetch failed: ${res.status}`); setMenuTree([]); return; }
      const data = await res.json();
      setMenuTree(data as ResolvedMenuItem[]);
    } catch (err) {
      setError(`Menu fetch error: ${err instanceof Error ? err.message : "Unknown"}`);
      setMenuTree([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, userRole, planCode]);

  useEffect(() => { fetchMenus(); }, [fetchMenus]);

  const flatMenus = useMemo(() => {
    const flat: ResolvedMenuItem[] = [];
    for (const root of menuTree) {
      flat.push(root);
      if (root.children) { for (const child of root.children) { flat.push(child); } }
    }
    return flat;
  }, [menuTree]);

  const getMenuByCode = useCallback((code: string) => flatMenus.find(m => m.menuCode === code), [flatMenus]);
  const getModuleMenus = useCallback((moduleCode: string) => flatMenus.filter(m => m.moduleCode === moduleCode), [flatMenus]);
  const getLabel = useCallback((menuCode: string) => {
    const menu = flatMenus.find(m => m.menuCode === menuCode);
    return menu ? menu.displayName : menuCode;
  }, [flatMenus]);

  const value = useMemo(() => ({
    menuTree, flatMenus, loading, error,
    refresh: fetchMenus, getMenuByCode, getModuleMenus, getLabel,
  }), [menuTree, flatMenus, loading, error, fetchMenus, getMenuByCode, getModuleMenus, getLabel]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useTenantMenu() { return useContext(MenuContext); }
export default MenuContext;
