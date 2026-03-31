"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface Props {
  role: string;
  name: string;
}

export function Navbar({ role, name }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex bg-brown-700 text-white px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥐</span>
          <span className="font-bold text-lg">Pastane Planlama</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"}>Dashboard</NavLink>
          <NavLink href="/weekly-plans" active={isActive("/weekly-plans")}>Planlar</NavLink>
          {role === "admin" && (
            <>
              <NavLink href="/products" active={isActive("/products")}>Ürünler</NavLink>
              <NavLink href="/base-products" active={isActive("/base-products")}>Baz Ürünler</NavLink>
              <NavLink href="/raw-materials" active={isActive("/raw-materials")}>Hammaddeler</NavLink>
              <NavLink href="/sales-history" active={isActive("/sales-history")}>Satış Geçmişi</NavLink>
              <NavLink href="/admin/users" active={isActive("/admin/users")}>Kullanıcılar</NavLink>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-cream-200 text-sm">{name}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm bg-brown-800 hover:bg-brown-900 px-3 py-1 rounded-lg">Çıkış</button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-cream-200 flex">
        <MobileNavLink href="/" active={pathname === "/"} icon="🏠">Dashboard</MobileNavLink>
        <MobileNavLink href="/weekly-plans" active={isActive("/weekly-plans")} icon="📅">Çizelge</MobileNavLink>
        {role === "admin" && (
          <>
            <MobileNavLink href="/products" active={isActive("/products")} icon="🧁">Ürünler</MobileNavLink>
            <MobileNavLink href="/raw-materials" active={isActive("/raw-materials")} icon="🧪">Hammadde</MobileNavLink>
          </>
        )}
      </nav>
    </>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`px-3 py-1.5 rounded-lg text-sm transition ${active ? "bg-brown-800 text-white" : "text-cream-200 hover:bg-brown-800"}`}>
      {children}
    </Link>
  );
}

function MobileNavLink({ href, active, icon, children }: { href: string; active: boolean; icon: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex-1 flex flex-col items-center py-2 text-xs transition ${active ? "text-brown-700 font-semibold" : "text-gray-500"}`}>
      <span className="text-xl">{icon}</span>
      {children}
    </Link>
  );
}
