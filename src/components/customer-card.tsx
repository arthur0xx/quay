import { formatRib } from "@/lib/banke";

export function CustomerCard({
  fullName,
  rib,
}: {
  fullName: string;
  rib: string;
}) {
  const name = fullName.trim() || "Your full name";
  const printed = rib.replace(/\s+/g, "")
    ? formatRib(rib)
    : "•••• •••• •••• ••••";

  return (
    <div className="relative overflow-hidden rounded-xl bg-accent p-5 text-accent-fg shadow-[var(--shadow-border)]">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-accent-fg/70">
        Payer card
      </p>
      <p className="mt-10 font-display text-2xl leading-tight tracking-tight">
        {name}
      </p>
      <p className="mt-3 font-mono text-sm tracking-wide">{printed}</p>
      <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.16em] text-accent-fg/70">
        Banké · send with the reference
      </p>
    </div>
  );
}
