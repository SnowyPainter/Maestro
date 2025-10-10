import { useState } from "react";
import { useAccountsPersonaCreateApiOrchestratorAccountsPersonasPost, getBffAccountsListPersonasApiBffAccountsPersonasGetQueryKey } from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import AvatarSelector from "@/components/ui/AvatarSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { components } from "@/lib/types/api";

type PersonaCreatePayload = components["schemas"]["PersonaCreatePayload"];

export function CreatePersonaForm({ onSuccess }: { onSuccess: (personaId: number) => void }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [tone, setTone] = useState("");
  const [styleGuide, setStyleGuide] = useState("");
  const [pillars, setPillars] = useState("");
  const [bannedWords, setBannedWords] = useState("");
  const [defaultHashtags, setDefaultHashtags] = useState("");

  const queryClient = useQueryClient();

  const { mutate: createPersona, isPending } = useAccountsPersonaCreateApiOrchestratorAccountsPersonasPost({
    mutation: {
      onSuccess: (data) => {
        onSuccess(data.id);
        queryClient.invalidateQueries({ queryKey: getBffAccountsListPersonasApiBffAccountsPersonasGetQueryKey() });
      },
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PersonaCreatePayload = {
      name,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      language,
      tone: tone || null,
      style_guide: styleGuide || null,
      pillars: pillars ? pillars.split(',').map(p => p.trim()) : null,
      banned_words: bannedWords ? bannedWords.split(',').map(w => w.trim()) : null,
      default_hashtags: defaultHashtags ? defaultHashtags.split(',').map(h => h.trim()) : null,
      schema_version: 1,
      is_active: true,
    };
    createPersona({ data: { persona: payload } });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg max-h-[70vh] overflow-y-auto">
      <div className="grid gap-2">
        <label htmlFor="name">Persona Name</label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tech Enthusiast"
          required
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="bio">Bio</label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A brief bio for this persona."
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="avatar_url">Avatar URL</label>
        <Input
          id="avatar_url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.png"
        />
        <AvatarSelector
          selectedAvatarUrl={avatarUrl}
          onAvatarSelect={setAvatarUrl}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
            <label htmlFor="language">Language</label>
            <Input
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            />
        </div>
        <div className="grid gap-2">
            <label htmlFor="tone">Tone</label>
            <Input
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. Witty, Formal"
            />
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="style_guide">Style Guide</label>
        <Textarea
          id="style_guide"
          value={styleGuide}
          onChange={(e) => setStyleGuide(e.target.value)}
          placeholder="e.g. Always use Oxford commas."
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="pillars">Content Pillars (comma-separated)</label>
        <Textarea
          id="pillars"
          value={pillars}
          onChange={(e) => setPillars(e.target.value)}
          placeholder="e.g. AI, Productivity, Tech News"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="banned_words">Banned Words (comma-separated)</label>
        <Input
          id="banned_words"
          value={bannedWords}
          onChange={(e) => setBannedWords(e.target.value)}
          placeholder="e.g. synergy, leverage"
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="default_hashtags">Default Hashtags (comma-separated)</label>
        <Input
          id="default_hashtags"
          value={defaultHashtags}
          onChange={(e) => setDefaultHashtags(e.target.value)}
          placeholder="e.g. #AI, #Tech"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Persona"}
      </Button>
    </form>
  );
}