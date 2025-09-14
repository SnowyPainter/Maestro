
import { BotMessageSquare } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <BotMessageSquare className="h-8 w-8 text-primary" />
      <h1 className="text-xl font-bold">Maestro</h1>
    </div>
  );
}
