import { createFileRoute, Link } from "@tanstack/react-router";
import { CATALOG } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/")({ component: Shop });

function Shop() {
  const add = useCart((s) => s.add);
  const featured = CATALOG[0];
  const rest = CATALOG.slice(1);

  return (
    <Shell>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <p className="quay-enter text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Sandbox catalog
        </p>
        <h1 className="quay-enter quay-enter-2 mt-3 max-w-2xl font-display text-4xl leading-[1.12] tracking-tight text-fg sm:text-5xl">
          Take payment. Send the bill. Stay off live money.
        </h1>
        <p className="quay-enter quay-enter-3 mt-4 max-w-xl text-base leading-relaxed text-muted">
          Quay is wired to PayPal Orders v2 and Invoicing v2. Until you add
          sandbox credentials, checkout rehearses a capture so you can walk the
          whole path.
        </p>
        <div className="quay-enter quay-enter-4 mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/checkout">Open checkout</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/invoices">Draft an invoice</Link>
          </Button>
        </div>

        {featured ? (
          <article className="mt-14 grid overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)] lg:grid-cols-[1.1fr_0.9fr]">
            <img
              src={featured.image}
              alt={featured.alt}
              className="aspect-square h-full w-full object-cover lg:aspect-auto lg:min-h-[28rem]"
            />
            <div className="flex flex-col justify-between p-6 sm:p-8">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  {featured.origin}
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-tight">
                  {featured.name}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                  {featured.blurb}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between gap-4">
                <p className="font-display text-2xl tabular-nums">
                  {formatMoney(featured.price)}
                </p>
                <Button onClick={() => add(featured.sku)}>Add to cart</Button>
              </div>
            </div>
          </article>
        ) : null}

        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((product) => (
            <li
              key={product.sku}
              className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]"
            >
              <img
                src={product.image}
                alt={product.alt}
                className="aspect-square w-full object-cover"
              />
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  {product.origin}
                </p>
                <h3 className="mt-1 font-display text-xl">{product.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                  {product.blurb}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="tabular-nums text-sm font-medium">
                    {formatMoney(product.price)}
                  </p>
                  <Button size="sm" onClick={() => add(product.sku)}>
                    Add
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
