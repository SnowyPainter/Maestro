import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Zap, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Platform-specific colors for gradients
const PLATFORM_COLORS = {
    instagram: {
        from: "from-pink-500",
        to: "to-purple-500",
        accent: "border-pink-200",
    },
    threads: {
        from: "from-gray-800",
        to: "to-black",
        accent: "border-gray-600",
    },
    linkedin: {
        from: "from-blue-600",
        to: "to-blue-800",
        accent: "border-blue-300",
    },
    twitter: {
        from: "from-blue-400",
        to: "to-blue-600",
        accent: "border-blue-200",
    },
    x: {
        from: "from-gray-900",
        to: "to-black",
        accent: "border-gray-500",
    },
    facebook: {
        from: "from-blue-500",
        to: "to-blue-700",
        accent: "border-blue-300",
    },
    youtube: {
        from: "from-red-500",
        to: "to-red-700",
        accent: "border-red-300",
    },
    tiktok: {
        from: "from-pink-400",
        to: "to-purple-600",
        accent: "border-pink-200",
    },
} as const;

interface DisplayPersonaAccountCardProps {
    personaAccount: {
        id: number;
        account_id: number;
        persona_name: string;
        persona_avatar_url?: string | null;
        persona_description?: string | null;
        account_handle: string;
        account_platform: string;
        account_avatar_url?: string | null;
        account_bio?: string | null;
        is_active?: boolean;
        can_permissions: (string | any)[];
        is_verified_link: boolean;
        last_updated_at?: string | null;
    };
    onSelect: (personaAccount: any) => void;
    isSelected?: boolean;
    isSelecting?: boolean;
    showAlreadyInjected?: boolean;
    prefersReducedMotion?: boolean;
    className?: string;
}

export function DisplayPersonaAccountCard({
    personaAccount,
    onSelect,
    isSelected = false,
    isSelecting = false,
    showAlreadyInjected = false,
    prefersReducedMotion = false,
    className,
}: DisplayPersonaAccountCardProps) {

    const platformColors = PLATFORM_COLORS[personaAccount.account_platform.toLowerCase() as keyof typeof PLATFORM_COLORS] ||
        PLATFORM_COLORS.x;

    const hasReadPermission = personaAccount.can_permissions.some(p =>
        String(p) === 'READ'
    );
    const hasWritePermission = personaAccount.can_permissions.some(p =>
        String(p) === 'WRITE'
    );
    const hasPublishPermission = personaAccount.can_permissions.some(p =>
        String(p) === 'PUBLISH'
    );

    return (
        <div
            className={cn(
                "relative rounded-2xl border shadow-md transition-all duration-300 overflow-hidden cursor-pointer",
                "bg-gradient-to-br text-white",
                platformColors.from,
                platformColors.to,
                `border-2 ${platformColors.accent}`,
                isSelected && "ring-2 ring-white/50 ring-offset-2 ring-offset-background",
                className
            )}
            onClick={() => onSelect(personaAccount)}
        >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/10" />
                <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-white/10" />
            </div>

            {/* Content */}
            <div className="relative p-5 space-y-4">
                {/* Header Section */}
                <div className="flex items-start justify-between gap-4">
                    {/* Persona Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 border-2 border-white/30 shadow-lg">
                            <AvatarImage src={personaAccount.persona_avatar_url || ''} alt={personaAccount.persona_name} />
                            <AvatarFallback className="text-white font-semibold bg-white/20">
                                {personaAccount.persona_name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-lg truncate text-white">
                                {personaAccount.persona_name}
                            </h3>
                            {personaAccount.persona_description && (
                                <p className="text-white/80 text-sm truncate mt-1">
                                    {personaAccount.persona_description}
                                </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                {personaAccount.is_verified_link && (
                                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100 border-emerald-300/30 text-xs">
                                        Verified
                                    </Badge>
                                )}
                                {personaAccount.is_active === false && (
                                    <Badge variant="secondary" className="bg-red-500/20 text-red-100 border-red-300/30 text-xs">
                                        Inactive
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex flex-col items-end gap-2">
                        <div className={cn(
                            "w-3 h-3 rounded-full border-2 border-white/50",
                            isSelected ? "bg-emerald-400" : "bg-white/80"
                        )} />
                        {isSelected && (
                            <CheckCircle className="h-5 w-5 text-emerald-300" />
                        )}
                    </div>
                </div>

                {/* Platform Account Info */}
                <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-white/30">
                                <AvatarImage src={personaAccount.account_avatar_url || ''} alt={personaAccount.account_handle} />
                                <AvatarFallback className="text-white/80 bg-white/20 text-xs">
                                    {personaAccount.account_handle.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-sm">
                                    @{personaAccount.account_handle}
                                </p>
                                <p className="text-white/80 text-xs capitalize">
                                    {personaAccount.account_platform}
                                </p>
                                {personaAccount.account_bio && (
                                    <p className="text-white/70 text-xs truncate mt-1">
                                        {personaAccount.account_bio}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Platform Badge */}
                        <Badge className="bg-white/20 text-white border-white/30 text-xs capitalize">
                            {personaAccount.account_platform}
                        </Badge>
                    </div>
                </div>

                {/* Permissions */}
                <div className="flex flex-wrap gap-2">
                    {hasReadPermission && (
                        <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs">
                            📖 Read
                        </Badge>
                    )}
                    {hasWritePermission && (
                        <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs">
                            ✍️ Write
                        </Badge>
                    )}
                    {hasPublishPermission && (
                        <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs">
                            📤 Publish
                        </Badge>
                    )}
                </div>

            </div>

            {/* Selection Overlay */}
            {(isSelecting || showAlreadyInjected) && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                    <div className="bg-white/95 rounded-xl px-6 py-4 shadow-2xl flex items-center gap-3">
                        {isSelecting ? (
                            <>
                                <Zap className="h-6 w-6 text-primary animate-pulse" />
                                <div>
                                    <p className="font-semibold text-gray-900">Injecting Account</p>
                                    <p className="text-sm text-gray-600">Setting up your persona...</p>
                                </div>
                            </>
                        ) : showAlreadyInjected ? (
                            <>
                                <div className="text-center">
                                    <p className="font-bold text-lg text-emerald-600 animate-bounce">Already Injected!!</p>
                                    <p className="text-sm text-gray-600">This persona is currently active</p>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}

        </div>
    );
}
