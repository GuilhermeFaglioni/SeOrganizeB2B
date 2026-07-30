"use client";

import { useState } from "react";
import { MailPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiPersonSelector } from "@/components/people/multi-person-selector";
import { useProfiles } from "@/hooks/use-profiles";
import { toastError } from "@/lib/toast";

export function EventAttendeeSelector({
  profileIds,
  attendeeEmails,
  onProfileIdsChange,
  onAttendeeEmailsChange,
}: {
  profileIds: string[];
  attendeeEmails: string[];
  onProfileIdsChange: (ids: string[]) => void;
  onAttendeeEmailsChange: (emails: string[]) => void;
}) {
  const { data: profiles = [], isLoading } = useProfiles();
  const [email, setEmail] = useState("");

  function addEmail() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toastError("E-mail inválido", "Informe um endereço de e-mail válido.");
      return;
    }
    if (!attendeeEmails.includes(normalized)) {
      onAttendeeEmailsChange([...attendeeEmails, normalized]);
    }
    setEmail("");
  }

  return (
    <div className="space-y-3">
      <MultiPersonSelector
        people={profiles}
        value={profileIds}
        onValueChange={onProfileIdsChange}
        disabled={isLoading}
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MailPlus className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEmail();
              }
            }}
            className="pl-9"
            type="email"
            placeholder="Convidar e-mail externo"
          />
        </div>
        <Button type="button" variant="outline" onClick={addEmail}>
          Adicionar
        </Button>
      </div>
      {attendeeEmails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attendeeEmails.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-page-alt px-2.5 py-1 text-xs text-text-primary"
            >
              {item}
              <button
                type="button"
                aria-label={`Remover ${item}`}
                onClick={() =>
                  onAttendeeEmailsChange(
                    attendeeEmails.filter((candidate) => candidate !== item),
                  )
                }
              >
                <X className="h-3 w-3 text-text-secondary" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
