
import { useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet } from "@/lib/api/generated";
import { Badge } from "@/components/ui/badge";

interface PersonaBadgeProps {
  personaId: number;
}

export function PersonaBadge({ personaId }: PersonaBadgeProps) {
  const { data: persona, isLoading } = useBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGet(personaId);

  if (isLoading) {
    return <Badge>Loading...</Badge>;
  }

  return <Badge>{persona?.name || 'Unknown Persona'}</Badge>;
}
