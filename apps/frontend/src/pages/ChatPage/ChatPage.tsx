import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ChatPage() {
  const [messages, setMessages] = useState<string[]>([]);

  return (
    <div className="grid grid-cols-[240px_1fr_280px] h-screen">
      {/* Left Nav */}
      <aside className="bg-neutral-100 p-4 flex flex-col">
        <div className="flex-1">Nav</div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <MoreHorizontal className="w-4 h-4 mr-2" />
                <span>Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/settings">Go to Settings</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Chat Stream */}
      <main className="flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl shadow-sm">
              {m}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <input
            type="text"
            className="border rounded p-2 w-2/3"
            placeholder="메시지를 입력하세요..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setMessages((prev) => [...prev, (e.target as HTMLInputElement).value]);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <Button className="ml-2">Send</Button>
        </div>
      </main>

      {/* Right Context Rail */}
      <aside className="bg-neutral-50 border-l p-4">Context</aside>
    </div>
  );
}
