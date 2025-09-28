import { useEffect, useRef, useState } from "react";
import { useAccountsPlatformCreateApiOrchestratorAccountsPlatformPost, PlatformAccountOut, PlatformKind } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import AvatarSelector from "@/components/ui/AvatarSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function CreateAccountForm({ onSuccess }: { onSuccess?: (account: PlatformAccountOut) => void }) {
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<PlatformKind>(PlatformKind.instagram);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const topFocusTrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topFocusTrapRef.current?.focus();
  }, []);

  const { mutate: createAccount, isPending, error } = useAccountsPlatformCreateApiOrchestratorAccountsPlatformPost({
    mutation: {
      onSuccess: (data) => {
        onSuccess?.(data);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccount({ 
        data: { 
            account: { 
                handle, 
                platform, 
                bio: bio || null,
                avatar_url: avatarUrl || null,
                is_active: isActive,
            }
        }
    });
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Create New Account</CardTitle>
        <CardDescription>Add a new platform account to manage.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} onMouseDown={() => topFocusTrapRef.current?.focus()}>
        <div
          ref={topFocusTrapRef}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none h-0 w-0 overflow-hidden"
        />
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="handle">Handle</label>
            <Input id="handle" value={handle} onChange={e => setHandle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <label htmlFor="platform">Platform</label>
            <select id="platform" value={platform} onChange={e => setPlatform(e.target.value as PlatformKind)} className="h-10 w-full rounded-xl border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary">
              {Object.values(PlatformKind).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar_url">Avatar URL</label>
            <Input id="avatar_url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
            <AvatarSelector
              selectedAvatarUrl={avatarUrl}
              onAvatarSelect={setAvatarUrl}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bio">Bio</label>
            <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="is_active" checked={isActive} onCheckedChange={checked => setIsActive(Boolean(checked))} />
            <label htmlFor="is_active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Is Active</label>
          </div>

        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Account"}
          </Button>
        </CardFooter>
      </form>
      {error && <div className="text-destructive p-4">{(error as any).detail?.[0]?.msg || 'An error occurred'}</div>}
    </Card>
  );
}
