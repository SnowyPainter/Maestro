import { BrainCircuit } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
    const sizeClasses = size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
    const textClasses = size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <div className="flex items-center gap-2">
        <BrainCircuit className={`${sizeClasses} text-primary`} />
        <h1 className={`${textClasses} font-bold text-foreground`}>Maestro</h1>
    </div>
  );
}