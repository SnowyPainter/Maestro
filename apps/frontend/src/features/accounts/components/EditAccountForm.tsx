
import { useState } from "react";
import { useAccountsPlatformUpdateApiOrchestratorAccountsPlatformAccountIdPut, PlatformAccountOut } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LinkPersonaForm } from "./LinkPersonaForm";

interface EditAccountFormProps {
  account: PlatformAccountOut;
  onSuccess?: () => void;
}

export function EditAccountForm({ account, onSuccess }: EditAccountFormProps) {
  const [handle, setHandle] = useState(account.handle || "");
  const [bio, setBio] = useState(account.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(account.avatar_url || "");
  const [isActive, setIsActive] = useState(account.is_active ?? true);

  const { mutate: updateAccount, isPending, error } = useAccountsPlatformUpdateApiOrchestratorAccountsPlatformAccountIdPut({
    mutation: {
      onSuccess: () => {
        onSuccess?.();
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAccount({ 
        accountId: account.id,
        data: { 
            data: { 
                handle, 
                bio: bio || null,
                avatar_url: avatarUrl || null,
                is_active: isActive,
            },
            account_id: account.id
        }
    });
  };

  return (
    <Card className="rounded-2xl border bg-card text-card-foreground shadow-md">
      <CardHeader>
        <CardTitle>Edit Account</CardTitle>
        <CardDescription>Update the details for @{account.handle}.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="handle">Handle</label>
            <Input id="handle" value={handle} onChange={e => setHandle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar_url">Avatar URL</label>
            <Input id="avatar_url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
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
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
      {error && <div className="text-destructive p-4">{(error as any).detail?.[0]?.msg || 'An error occurred'}</div>}

      <div className="border-t p-6">
        <LinkPersonaForm account={account} />
      </div>
    </Card>
  );
}
