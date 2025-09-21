import { ControlTower } from "@/widgets/ControlTower/ControlTower";

export function ControlTowerPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-muted/40">
      <header className="p-4 border-b bg-card shadow-sm">
          <h1 className="text-xl font-semibold">Control Tower</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ControlTower />
      </main>
    </div>
  );
}