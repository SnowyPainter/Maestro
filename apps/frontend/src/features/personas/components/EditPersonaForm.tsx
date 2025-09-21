import { useState } from "react";
import {
    useAccountsPersonaUpdateApiOrchestratorAccountsPersonasPersonaIdPut,
    getBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGetQueryKey,
    PersonaOut,
} from "@/lib/api/generated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { components } from "@/lib/types/api";
import { Plus, Trash2 } from "lucide-react";

type PersonaUpdate = components["schemas"]["PersonaUpdate"];

type KeyValueRow = {
  id: string;
  key: string;
  value: string;
};

type PostingWindowRow = {
  id: string;
  dow: string;
  start: string;
  end: string;
};

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const allowedHashtagCasings = ["original", "lower", "upper"] as const;

const createRowId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const toKeyValueRows = (record: Record<string, unknown> | undefined, prefix: string): KeyValueRow[] => {
  if (!record) {
    return [];
  }
  return Object.entries(record)
    .filter(([key]) => typeof key === "string")
    .map(([key, value]) => ({
      id: createRowId(prefix),
      key,
      value: value === undefined || value === null ? "" : String(value),
    }));
};

const toPostingWindowRows = (rows: Array<Record<string, unknown>> | undefined): PostingWindowRow[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    id: createRowId("posting"),
    dow: typeof row?.dow === "string" && daysOfWeek.includes(row.dow) ? row.dow : "Mon",
    start: typeof row?.start === "string" ? row.start : "09:00",
    end: typeof row?.end === "string" ? row.end : "11:00",
  }));
};

export function EditPersonaForm({ persona, onSuccess }: { persona: PersonaOut, onSuccess: () => void }) {
  const [name, setName] = useState(persona.name || "");
  const [bio, setBio] = useState(persona.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(persona.avatar_url || "");
  const [language, setLanguage] = useState(persona.language || "en");
  const [tone, setTone] = useState(persona.tone || "");
  const [styleGuide, setStyleGuide] = useState(persona.style_guide || "");
  const [pillars, setPillars] = useState(persona.pillars?.join(", ") || "");
  const [bannedWords, setBannedWords] = useState(persona.banned_words?.join(", ") || "");
  const [defaultHashtags, setDefaultHashtags] = useState(persona.default_hashtags?.join(", ") || "");

  const initialHashtagRules = persona.hashtag_rules ?? {};
  const [hashtagMaxCount, setHashtagMaxCount] = useState(
    typeof initialHashtagRules?.max_count === "number" ? String(initialHashtagRules.max_count) : ""
  );
  const [hashtagCasing, setHashtagCasing] = useState(
    typeof initialHashtagRules?.casing === "string" ? initialHashtagRules.casing : "original"
  );
  const [hashtagPinned, setHashtagPinned] = useState(
    Array.isArray(initialHashtagRules?.pinned) ? (initialHashtagRules.pinned as string[]).join(", ") : ""
  );

  const initialLinkPolicy = persona.link_policy ?? {};
  const [linkInBio, setLinkInBio] = useState(
    typeof initialLinkPolicy?.link_in_bio === "string" ? initialLinkPolicy.link_in_bio : ""
  );
  const [utmParams, setUtmParams] = useState<KeyValueRow[]>(() => {
    const utmRecord = initialLinkPolicy?.utm as Record<string, unknown> | undefined;
    const rows = toKeyValueRows(utmRecord, "utm");
    return rows.length ? rows : [{ id: createRowId("utm"), key: "utm_source", value: "" }];
  });

  const initialMediaPrefs = persona.media_prefs ?? {};
  const [preferredRatio, setPreferredRatio] = useState(
    typeof initialMediaPrefs?.preferred_ratio === "string" ? initialMediaPrefs.preferred_ratio : ""
  );
  const [allowCarousel, setAllowCarousel] = useState(Boolean(initialMediaPrefs?.allow_carousel));

  const [postingWindows, setPostingWindows] = useState<PostingWindowRow[]>(() => {
    const rows = toPostingWindowRows(persona.posting_windows as Array<Record<string, unknown>> | undefined);
    return rows.length ? rows : [];
  });

  const initialReplaceMap = (persona.extras as Record<string, unknown> | undefined)?.replace_map as Record<string, unknown> | undefined;
  const [replaceMapRows, setReplaceMapRows] = useState<KeyValueRow[]>(() => {
    const rows = toKeyValueRows(initialReplaceMap, "replace");
    return rows.length ? rows : [{ id: createRowId("replace"), key: "{{brand}}", value: "Acme" }];
  });

  const [schemaVersion, setSchemaVersion] = useState(persona.schema_version ? String(persona.schema_version) : "");
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { mutate: updatePersona, isPending } = useAccountsPersonaUpdateApiOrchestratorAccountsPersonasPersonaIdPut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getBffAccountsReadPersonaApiBffAccountsPersonasPersonaIdGetQueryKey(persona.id) });
        onSuccess();
      },
    }
  });

  const handleAddUtmParam = () => {
    setUtmParams((prev) => [...prev, { id: createRowId("utm"), key: "", value: "" }]);
  };

  const handleRemoveUtmParam = (id: string) => {
    setUtmParams((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAddPostingWindow = () => {
    setPostingWindows((prev) => [
      ...prev,
      { id: createRowId("posting"), dow: "Mon", start: "09:00", end: "11:00" },
    ]);
  };

  const handleRemovePostingWindow = (id: string) => {
    setPostingWindows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAddReplaceMapRow = () => {
    setReplaceMapRows((prev) => [...prev, { id: createRowId("replace"), key: "", value: "" }]);
  };

  const handleRemoveReplaceMapRow = (id: string) => {
    setReplaceMapRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const pinnedList = hashtagPinned
        ? hashtagPinned.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];

      const hashtagRules: Record<string, unknown> = {};
      if (hashtagMaxCount.trim()) {
        const parsed = Number(hashtagMaxCount);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error("Hashtag max count must be a positive integer");
        }
        hashtagRules.max_count = parsed;
      }
      if (hashtagCasing && allowedHashtagCasings.includes(hashtagCasing as typeof allowedHashtagCasings[number])) {
        hashtagRules.casing = hashtagCasing;
      }
      if (pinnedList.length) {
        hashtagRules.pinned = pinnedList;
      }

      const utm = utmParams.reduce<Record<string, string>>((acc, row) => {
        const key = row.key.trim();
        if (key) {
          acc[key] = row.value.trim();
        }
        return acc;
      }, {});

      const linkPolicy: Record<string, unknown> = {};
      if (linkInBio.trim()) {
        linkPolicy.link_in_bio = linkInBio.trim();
      }
      if (Object.keys(utm).length) {
        linkPolicy.utm = utm;
      }

      const mediaPrefs: Record<string, unknown> = {};
      if (preferredRatio.trim()) {
        mediaPrefs.preferred_ratio = preferredRatio.trim();
      }
      mediaPrefs.allow_carousel = allowCarousel;

      const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      const postingWindowPayload = postingWindows
        .map((window) => ({
          dow: window.dow,
          start: window.start,
          end: window.end,
        }))
        .filter(({ dow, start, end }) => dow && start && end);

      for (const window of postingWindowPayload) {
        if (!daysOfWeek.includes(window.dow)) {
          throw new Error("Posting window day must be a valid weekday");
        }
        if (!timePattern.test(window.start) || !timePattern.test(window.end)) {
          throw new Error("Posting window times must follow HH:MM format");
        }
      }

      const replaceMapApplied = replaceMapRows.reduce<Record<string, string>>((acc, row) => {
        const key = row.key.trim();
        if (key) {
          acc[key] = row.value;
        }
        return acc;
      }, {});

      const extras: Record<string, unknown> = {};
      if (Object.keys(replaceMapApplied).length) {
        extras.replace_map = replaceMapApplied;
      }

      const payload: PersonaUpdate = {
        name,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        language,
        tone: tone || null,
        style_guide: styleGuide || null,
        pillars: pillars ? pillars.split(',').map(p => p.trim()).filter(Boolean) : null,
        banned_words: bannedWords ? bannedWords.split(',').map(w => w.trim()).filter(Boolean) : null,
        default_hashtags: defaultHashtags ? defaultHashtags.split(',').map(h => h.trim()).filter(Boolean) : null,
        hashtag_rules: Object.keys(hashtagRules).length ? hashtagRules : null,
        link_policy: Object.keys(linkPolicy).length ? linkPolicy : null,
        media_prefs: Object.keys(mediaPrefs).length ? mediaPrefs : null,
        posting_windows: postingWindowPayload.length ? postingWindowPayload : null,
        extras: Object.keys(extras).length ? extras : null,
      };

      if (schemaVersion.trim()) {
        const parsedSchemaVersion = Number(schemaVersion);
        if (!Number.isInteger(parsedSchemaVersion) || parsedSchemaVersion <= 0) {
          throw new Error("Schema version must be a positive integer");
        }
        payload.schema_version = parsedSchemaVersion;
      }

      updatePersona({ personaId: persona.id, data: { data: payload } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit persona update";
      setFormError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 p-4 border rounded-lg max-h-[70vh] overflow-y-auto">
      {formError ? (
        <p className="text-sm text-red-500" role="alert">{formError}</p>
      ) : null}

      <section className="grid gap-2">
        <label htmlFor="name" className="text-sm font-medium">Persona Name</label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tech Enthusiast"
          required
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor="bio" className="text-sm font-medium">Bio</label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short persona description"
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor="avatar_url" className="text-sm font-medium">Avatar URL</label>
        <Input
          id="avatar_url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.png"
        />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label htmlFor="language" className="text-sm font-medium">Language</label>
          <Input
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="tone" className="text-sm font-medium">Tone</label>
          <Input
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. Witty, Formal"
          />
        </div>
      </section>

      <section className="grid gap-2">
        <label htmlFor="style_guide" className="text-sm font-medium">Style Guide</label>
        <Textarea
          id="style_guide"
          value={styleGuide}
          onChange={(e) => setStyleGuide(e.target.value)}
          placeholder="Writing tips and brand guidance"
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor="pillars" className="text-sm font-medium">Content Pillars (comma-separated)</label>
        <Textarea
          id="pillars"
          value={pillars}
          onChange={(e) => setPillars(e.target.value)}
          placeholder="e.g. AI, Productivity, Tech News"
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor="banned_words" className="text-sm font-medium">Banned Words (comma-separated)</label>
        <Input
          id="banned_words"
          value={bannedWords}
          onChange={(e) => setBannedWords(e.target.value)}
          placeholder="e.g. synergy, leverage"
        />
      </section>

      <section className="grid gap-2">
        <label htmlFor="default_hashtags" className="text-sm font-medium">Default Hashtags</label>
        <Input
          id="default_hashtags"
          value={defaultHashtags}
          onChange={(e) => setDefaultHashtags(e.target.value)}
          placeholder="e.g. #AI, #Tech"
        />
      </section>

      <section className="space-y-3 border rounded-md p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Hashtag Rules</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <label htmlFor="hashtag_max" className="text-xs uppercase tracking-wide text-muted-foreground">Max Count</label>
            <Input
              id="hashtag_max"
              value={hashtagMaxCount}
              onChange={(e) => setHashtagMaxCount(e.target.value)}
              placeholder="e.g. 10"
              inputMode="numeric"
            />
          </div>
          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Casing</span>
            <Select value={hashtagCasing} onValueChange={setHashtagCasing}>
              <SelectTrigger>
                <SelectValue placeholder="Select casing" />
              </SelectTrigger>
              <SelectContent>
                {allowedHashtagCasings.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="hashtag_pinned" className="text-xs uppercase tracking-wide text-muted-foreground">Pinned Hashtags</label>
            <Input
              id="hashtag_pinned"
              value={hashtagPinned}
              onChange={(e) => setHashtagPinned(e.target.value)}
              placeholder="e.g. #Brand, #Campaign"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 border rounded-md p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Link Policy</h3>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddUtmParam}>
            <Plus className="h-4 w-4 mr-1" />Add UTM Param
          </Button>
        </div>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <label htmlFor="link_in_bio" className="text-xs uppercase tracking-wide text-muted-foreground">Link In Bio</label>
            <Input
              id="link_in_bio"
              value={linkInBio}
              onChange={(e) => setLinkInBio(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            {utmParams.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  value={row.key}
                  onChange={(e) => setUtmParams((prev) => prev.map((item) => item.id === row.id ? { ...item, key: e.target.value } : item))}
                  placeholder="utm_source"
                  className="flex-1"
                />
                <Input
                  value={row.value}
                  onChange={(e) => setUtmParams((prev) => prev.map((item) => item.id === row.id ? { ...item, value: e.target.value } : item))}
                  placeholder="email"
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveUtmParam(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 border rounded-md p-3">
        <h3 className="text-sm font-semibold">Media Preferences</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label htmlFor="preferred_ratio" className="text-xs uppercase tracking-wide text-muted-foreground">Preferred Ratio</label>
            <Input
              id="preferred_ratio"
              value={preferredRatio}
              onChange={(e) => setPreferredRatio(e.target.value)}
              placeholder="e.g. 9:16"
            />
          </div>
          <div className="flex items-center gap-2 mt-6 sm:mt-0">
            <Checkbox
              id="allow_carousel"
              checked={allowCarousel}
              onCheckedChange={(checked) => setAllowCarousel(Boolean(checked))}
            />
            <label htmlFor="allow_carousel" className="text-sm">Allow Carousel</label>
          </div>
        </div>
      </section>

      <section className="space-y-3 border rounded-md p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Posting Windows</h3>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddPostingWindow}>
            <Plus className="h-4 w-4 mr-1" />Add Window
          </Button>
        </div>
        <div className="space-y-2">
          {postingWindows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posting windows configured.</p>
          ) : null}
          {postingWindows.map((row) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-center">
              <Select
                value={row.dow || "Mon"}
                onValueChange={(value) => setPostingWindows((prev) => prev.map((item) => item.id === row.id ? { ...item, dow: value } : item))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={row.start}
                onChange={(e) => setPostingWindows((prev) => prev.map((item) => item.id === row.id ? { ...item, start: e.target.value } : item))}
              />
              <Input
                type="time"
                value={row.end}
                onChange={(e) => setPostingWindows((prev) => prev.map((item) => item.id === row.id ? { ...item, end: e.target.value } : item))}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePostingWindow(row.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border rounded-md p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Extras · Replace Map</h3>
          <Button type="button" variant="ghost" size="sm" onClick={handleAddReplaceMapRow}>
            <Plus className="h-4 w-4 mr-1" />Add Mapping
          </Button>
        </div>
        <div className="space-y-2">
          {replaceMapRows.map((row) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-center">
              <Input
                value={row.key}
                onChange={(e) => setReplaceMapRows((prev) => prev.map((item) => item.id === row.id ? { ...item, key: e.target.value } : item))}
                placeholder="{{placeholder}}"
              />
              <Input
                value={row.value}
                onChange={(e) => setReplaceMapRows((prev) => prev.map((item) => item.id === row.id ? { ...item, value: e.target.value } : item))}
                placeholder="Replacement value"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveReplaceMapRow(row.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <label htmlFor="schema_version" className="text-sm font-medium">Schema Version</label>
        <Input
          id="schema_version"
          value={schemaVersion}
          onChange={(e) => setSchemaVersion(e.target.value)}
          placeholder="Leave blank to keep current version"
          inputMode="numeric"
        />
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Update Persona"}
      </Button>
    </form>
  );
}
