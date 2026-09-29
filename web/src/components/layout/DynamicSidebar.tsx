"use client";
/**
 * DynamicSidebar
 * Phase 5 C11: DOC-000088 S13
 * Adyaya Solutions Private Limited
 */
import React, { useState } from "react";
import { useTenantMenu, ResolvedMenuItem } from "../../lib/menu/TenantMenuProvider";

function SidebarItem({ item, depth = 0 }: { item: ResolvedMenuItem; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const pl = 12 + depth * 16;

  if (item.isSection) {
    return (
      <div className="mt-4 mb-1 px-3" style={{ paddingLeft: `${pl}px` }}>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{item.displayName}</span>
      </div>
    );
  }

  const handleClick = hasChildren
    ? (e: React.MouseEvent) => { e.preventDefault(); setExpanded(!expanded); }
    : undefined;

  return (
    <div>
      <a href={item.routePath || "#"} onClick={handleClick} className="flex items-center gap-2 py-2 px-3 text-sm rounded hover:bg-gray-100 transition-colors" style={{ paddingLeft: `${pl}px` }}>
        {item.icon && <span className="text-gray-400 w-5 text-center">{item.icon}</span>}
        <span className="flex-1">{item.displayName}</span>
        {item.labelOverride && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Label overridden"></span>}
        {hasChildren && <span className={`text-gray-400 text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>{"Γû╢"}</span>}
      </a>
      {hasChildren && expanded && (
        <div>
          {item.children.map(child => (
            <SidebarItem key={child.menuCode} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DynamicSidebar() {
  const { menuTree, loading, error } = useTenantMenu();

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading menus...</div>;
  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (menuTree.length === 0) return <div className="p-4 text-sm text-gray-400">No menus configured</div>;

  return (
    <nav className="py-2">
      {menuTree.map(item => (
        <SidebarItem key={item.menuCode} item={item} />
      ))}
    </nav>
  );
}
