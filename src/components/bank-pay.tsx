import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  newReference,
  useBanke,
  type BankAccount,
  type TransferItem,
  type TransferKind,
} from "@/lib/banke";
import { readProofImage } from "@/lib/proof-image";
import { BankInstructions } from "@/components/bank-instructions";
import { CustomerCard } from "@/components/customer-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BankPay({
  amount,
  kind,
  items,
  onSubmitted,
  submitLabel,
}: {
  amount: string;
  kind: TransferKind;
  items?: TransferItem[];
  onSubmitted?: () => void;
  submitLabel: string;
}) {
  const banks = useBanke((s) => s.banks);
  const savedName = useBanke((s) => s.payerName);
  const savedRib = useBanke((s) => s.payerRib);
  const submitTransfer = useBanke((s) => s.submitTransfer);
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [reference, setReference] = useState(newReference);
  const [payerName, setPayerName] = useState(savedName);
  const [payerRib, setPayerRib] = useState(savedRib);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bank = useMemo(
    () => banks.find((row) => row.id === bankId) ?? banks[0] ?? null,
    [banks, bankId],
  );

  useEffect(() => {
    if (!bankId && banks[0]) setBankId(banks[0].id);
  }, [bankId, banks]);

  useEffect(() => {
    if (savedName && !payerName) setPayerName(savedName);
    if (savedRib && !payerRib) setPayerRib(savedRib);
  }, [savedName, savedRib, payerName, payerRib]);

  function selectBank(id: string) {
    setBankId(id);
    setReference(newReference());
  }

  async function onProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setProofImage(await readProofImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Screenshot failed");
    }
  }

  function onSend() {
    if (!bank) {
      toast.error("Add a bank in Admin first.");
      return;
    }
    if (payerName.trim().length < 2) {
      toast.error("Enter the payer’s full name.");
      return;
    }
    if (payerRib.replace(/\s+/g, "").length < 10) {
      toast.error("Enter the payer’s RIB.");
      return;
    }
    if (!proofImage) {
      toast.error("Attach a screenshot of the transfer.");
      return;
    }
    setBusy(true);
    submitTransfer({
      kind,
      amount,
      bank,
      reference,
      payerName,
      payerRib,
      proofImage,
      items,
    });
    toast.success("Slip and screenshot sent to Inbox.");
    setReference(newReference());
    setProofImage(null);
    setBusy(false);
    onSubmitted?.();
  }

  if (banks.length === 0) {
    return (
      <p className="text-sm text-muted">
        No bank is on file. Add a RIB from Admin, then come back.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="banke-bank">Pay to</Label>
        <select
          id="banke-bank"
          className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
          value={bank?.id}
          onChange={(e) => selectBank(e.target.value)}
        >
          {banks.map((row) => (
            <option key={row.id} value={row.id}>
              {row.bankName} · {row.holderName}
            </option>
          ))}
        </select>
      </div>
      {bank ? (
        <BankInstructions bank={bank} reference={reference} amount={amount} />
      ) : null}

      <div className="space-y-3 rounded-xl bg-bg p-4">
        <h3 className="font-display text-xl">Your card</h3>
        <p className="text-sm text-muted">
          This is the account the money leaves from — full name and RIB as they
          appear on your statement.
        </p>
        <CustomerCard fullName={payerName} rib={payerRib} />
        <div className="space-y-1.5">
          <Label htmlFor="payer-name">Full name</Label>
          <Input
            id="payer-name"
            autoComplete="name"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="As printed on your RIB"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payer-rib">Your RIB</Label>
          <Input
            id="payer-rib"
            className="font-mono"
            value={payerRib}
            onChange={(e) => setPayerRib(e.target.value)}
            placeholder="24 digits"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payer-proof">Screenshot of the transfer</Label>
          <Input
            id="payer-proof"
            type="file"
            accept="image/*"
            onChange={onProof}
          />
        </div>
        {proofImage ? (
          <img
            src={proofImage}
            alt="Transfer screenshot"
            className="max-h-48 w-full rounded-md object-cover"
          />
        ) : null}
      </div>

      <Button
        className="h-12 w-full"
        type="button"
        disabled={busy}
        onClick={onSend}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

export function bankLabel(bank: BankAccount) {
  return `${bank.holderName} · ${bank.bankName}`;
}
