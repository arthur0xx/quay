import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useBanke } from "@/lib/banke";
import { cartCount, useCart } from "@/lib/cart";
import { useInvoiceBook } from "@/lib/invoice-book";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", label: "Shop" },
  { to: "/wallet", label: "Wallet" },
  { to: "/invoices", label: "Invoices" },
  { to: "/admin", label: "Admin" },
  { to: "/connect", label: "Connect" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = useCart((s) => cartCount(s.lines));
  const pending = useBanke(
    (s) => s.transfers.filter((row) => row.status === "sent").length,
  );

  useEffect(() => {
    void useInvoiceBook.persist.rehydrate();
    void useBanke.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 sm:flex-nowrap sm:gap-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-baseline gap-2">
            <span className="font-display text-xl tracking-tight text-fg">
              Quay
            </span>
            <span className="hidden text-xs tracking-[0.16em] text-muted uppercase sm:inline">
              Merchant desk
            </span>
          </Link>
          <Badge variant="sandbox">Sandbox</Badge>
          <nav className="ml-auto flex min-w-0 items-center">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex h-11 items-center px-2 text-sm transition-colors duration-[var(--motion-quick)] sm:px-3",
                    active ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                  {item.to === "/admin" && pending > 0 ? (
                    <span className="ml-1 tabular-nums text-accent">
                      {pending}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <Link
              to="/checkout"
              className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg transition-colors duration-[var(--motion-quick)] hover:bg-fg/5"
              aria-label={count ? `Cart, ${count} items` : "Cart"}
            >
              <ShoppingBag className="size-4" strokeWidth={1.75} />
              {count > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-fg text-[0.625rem] text-bg tabular-nums">
                  {count}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
        Quay takes PayPal sandbox and Banké virements. No Stripe. No live money.
      </footer>
    </div>
  );
}
