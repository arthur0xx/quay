import { toast } from "sonner";
import type { BankAccount } from "@/lib/banke";
import { OTHER_BANK_ETA, SAME_BANK_ETA, formatRib } from "@/lib/banke";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function copy(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy"),
  );
}

export function BankInstructions({
  bank,
  reference,
  amount,
}: {
  bank: BankAccount;
  reference: string;
  amount: string;
}) {
  const rows = [
    { label: "Full name", value: bank.holderName },
    { label: "RIB", value: formatRib(bank.rib), raw: bank.rib },
    { label: "Reference", value: reference },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Send exactly {formatMoney(amount)} and put the reference in the transfer
        reason. Inbox gets this same slip so the desk can match it.
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {row.label}
              </p>
              <p className="mt-1 break-all font-mono text-sm">{row.value}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(row.label, row.raw ?? row.value)}
            >
              Copy
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        Same bank as {bank.bankName}: credit in {SAME_BANK_ETA}. Another bank:
        arrives in {OTHER_BANK_ETA}. After it lands, the desk confirms it in
        Inbox and the balance posts.
      </p>
    </div>
  );
}
