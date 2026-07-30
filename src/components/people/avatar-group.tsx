import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PersonSummary {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

function initials(person: PersonSummary) {
  const source = person.name?.trim() || person.email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AvatarGroup({
  people,
  limit = 3,
  size = "sm",
}: {
  people: PersonSummary[];
  limit?: number;
  size?: "xs" | "sm";
}) {
  const visible = people.slice(0, limit);
  const remaining = Math.max(people.length - visible.length, 0);

  if (people.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2" aria-label={`${people.length} assignees`}>
      {visible.map((person) => (
        <Avatar
          key={person.id}
          className={cn(
            "border-2 border-white bg-brand-100",
            size === "xs" ? "h-5 w-5" : "h-7 w-7"
          )}
          title={person.name || person.email}
        >
          {person.avatarUrl && (
            <AvatarImage src={person.avatarUrl} alt={person.name || person.email} />
          )}
          <AvatarFallback className="bg-brand-100 text-[9px] font-semibold text-brand-700">
            {initials(person)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            "relative grid place-items-center rounded-full border-2 border-white bg-slate-100 font-semibold text-slate-600",
            size === "xs" ? "h-5 min-w-5 px-1 text-[8px]" : "h-7 min-w-7 px-1 text-[9px]"
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
