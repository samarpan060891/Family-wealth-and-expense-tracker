"use client";
import { PageHeader } from "@/components/ui";
import { RemindersPanel } from "@/components/reminders-panel";

export default function RemindersPage() {
  return (
    <div className="flex flex-col gap-5 stagger max-w-2xl">
      <PageHeader
        title="Reminders"
        accent="Action needed"
        sub="EMIs, premiums, bills, renewals & maturities — cleared once you mark them done"
      />
      <RemindersPanel />
    </div>
  );
}
