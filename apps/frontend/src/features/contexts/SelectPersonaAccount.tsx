import { useState, useEffect, useRef, useCallback } from "react";
import { ContextCard } from "./ContextCard";
import { useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, User, Zap, Loader2 } from "lucide-react";
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

interface SelectPersonaAccountProps {
    onSelect?: () => void;
    className?: string;
}

// Helper function to get platform colors
const getPlatformColors = (platform: string) => {
    const platformKey = platform.toLowerCase() as keyof typeof PLATFORM_COLORS;
    return PLATFORM_COLORS[platformKey] || PLATFORM_COLORS.x; // Default to X colors
};

export function SelectPersonaAccount({ onSelect, className }: SelectPersonaAccountProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [injectingAccount, setInjectingAccount] = useState<string | null>(null);
    const touchStartX = useRef<number>(0);
    const touchEndX = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const { setPersonaContext } = usePersonaContextStore();

    const { data: richPersonaAccounts, isLoading } = useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet({
        query: { enabled: true }
    });

    const handleSelectPersonaAccount = useCallback((richPersonaAccount: any) => {
        // Start injection animation
        setInjectingAccount(String(richPersonaAccount.id));

        // After 0.8 seconds, complete the selection
        setTimeout(() => {
            setPersonaContext({
                personaAccountId: richPersonaAccount.id,
                personaId: richPersonaAccount.persona_id,
                personaName: richPersonaAccount.persona_name,
                personaAvatarUrl: richPersonaAccount.persona_avatar_url || null,
                accountId: richPersonaAccount.account_id,
                accountHandle: richPersonaAccount.account_handle,
                accountPlatform: richPersonaAccount.account_platform,
                accountAvatarUrl: richPersonaAccount.account_avatar_url || null,
            });
            setInjectingAccount(null);
            onSelect?.();
        }, 800); // 0.8 seconds injection animation
    }, [setPersonaContext, onSelect]);

    const nextSlide = useCallback(() => {
        if (!richPersonaAccounts?.length || isAnimating) return;
        setIsAnimating(true);
        setCurrentIndex((prev) => (prev + 1) % richPersonaAccounts.length);
        setTimeout(() => setIsAnimating(false), 300);
    }, [richPersonaAccounts?.length, isAnimating]);

    const prevSlide = useCallback(() => {
        if (!richPersonaAccounts?.length || isAnimating) return;
        setIsAnimating(true);
        setCurrentIndex((prev) => (prev - 1 + richPersonaAccounts.length) % richPersonaAccounts.length);
        setTimeout(() => setIsAnimating(false), 300);
    }, [richPersonaAccounts?.length, isAnimating]);

    // Touch handlers for swipe gestures
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartX.current || !touchEndX.current) return;

        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            nextSlide();
        } else if (isRightSwipe) {
            prevSlide();
        }

        touchStartX.current = 0;
        touchEndX.current = 0;
    }, [nextSlide, prevSlide]);

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                prevSlide();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextSlide, prevSlide]);

    if (isLoading) {
        return (
            <div className={cn("w-full max-w-md mx-auto", className)}>
                <div className="rounded-2xl border bg-card shadow-md p-8">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Loading persona accounts...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!richPersonaAccounts?.length) {
        return (
            <div className={cn("w-full max-w-md mx-auto", className)}>
                <div className="rounded-2xl border bg-card shadow-md p-8">
                    <div className="flex flex-col items-center justify-center space-y-6 text-center">
                        <div className="rounded-full bg-muted p-4">
                            <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">No persona accounts found</p>
                            <p className="text-xs text-muted-foreground">
                                Create a persona and link it to a platform account to get started.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full max-w-md mx-auto relative", className)}>
            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                    Select Persona Account
                </h2>
                <p className="text-sm text-muted-foreground">
                    Choose a persona account to start your conversation
                </p>
            </div>

            {/* Carousel Container */}
            <div
                ref={containerRef}
                className="relative overflow-hidden touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className={cn(
                        "flex transform-gpu will-change-transform",
                        !prefersReducedMotion && "transition-transform duration-300 ease-out",
                        isAnimating && !prefersReducedMotion && "transition-none"
                    )}
                    style={{
                        transform: `translateX(-${currentIndex * 100}%)`,
                    }}
                >
                    {richPersonaAccounts.map((personaAccount, index) => {
                        const platformColors = getPlatformColors(personaAccount.account_platform);
                        const isInjecting = injectingAccount === String(personaAccount.id);

                        return (
                            <div
                                key={personaAccount.id}
                                className="w-full flex-shrink-0 px-2"
                            >
                                <div className="relative group">
                                    <ContextCard
                                        icon={User}
                                        label={personaAccount.persona_name}
                                        value={`${personaAccount.account_handle} · ${personaAccount.account_platform}`}
                                        enabled={true}
                                        toggleDisabled={true}
                                        variant="persona"
                                        personaAvatarUrl={personaAccount.persona_avatar_url || undefined}
                                        accountHandle={personaAccount.account_handle}
                                        accountPlatform={personaAccount.account_platform}
                                        accountAvatarUrl={personaAccount.account_avatar_url || undefined}
                                        helper={`Select ${personaAccount.persona_name} to continue`}
                                        platformGradient={`bg-gradient-to-br ${platformColors.from} ${platformColors.to} border-2 ${platformColors.accent}`}
                                        className={!prefersReducedMotion ? "transition-transform duration-200 hover:scale-[0.98]" : ""}
                                    />
                                    {/* Injection Animation Overlay */}
                                    {isInjecting && (
                                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                            <div className="flex items-center gap-3 bg-background/90 rounded-full px-4 py-2 shadow-lg">
                                                <Zap className="h-5 w-5 text-primary animate-pulse" />
                                                <span className="text-sm font-medium">Injecting...</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <div className="mt-4 flex justify-center">
                                        <Button
                                            size="lg"
                                            disabled={isInjecting}
                                            className={cn(
                                                "h-12 px-6 rounded-xl font-medium relative overflow-hidden",
                                                !prefersReducedMotion && "transition-all duration-200",
                                                "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary",
                                                !prefersReducedMotion && "shadow-lg hover:shadow-xl transform hover:scale-95",
                                                "focus-visible:ring-2 focus-visible:ring-primary/50",
                                                "disabled:opacity-50 disabled:cursor-not-allowed"
                                            )}
                                            onClick={() => handleSelectPersonaAccount(personaAccount)}
                                        >
                                            {isInjecting ? (
                                                <>
                                                    <Zap className="h-4 w-4 mr-2 animate-pulse" />
                                                    <span className="animate-pulse">Injecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="h-4 w-4 mr-2" />
                                                    <span>Select Account</span>
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Controls */}
            {richPersonaAccounts.length > 1 && (
                <>
                    {/* Previous Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
                            "bg-background/80 backdrop-blur-sm border shadow-lg",
                            !prefersReducedMotion && "hover:bg-background hover:scale-110 transition-all duration-200",
                            "focus-visible:ring-2 focus-visible:ring-primary/50",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        onClick={prevSlide}
                        disabled={isAnimating}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>

                    {/* Next Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "absolute right-0 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full",
                            "bg-background/80 backdrop-blur-sm border shadow-lg",
                            !prefersReducedMotion && "hover:bg-background hover:scale-110 transition-all duration-200",
                            "focus-visible:ring-2 focus-visible:ring-primary/50",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                        onClick={nextSlide}
                        disabled={isAnimating}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </Button>

                    {/* Indicators */}
                    <div className="flex justify-center mt-6 gap-2">
                        {richPersonaAccounts.map((_, index) => (
                            <button
                                key={index}
                                className={cn(
                                    "h-2 rounded-full",
                                    !prefersReducedMotion && "transition-all duration-300",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                    index === currentIndex
                                        ? "w-8 bg-primary"
                                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                )}
                                onClick={() => {
                                    if (!isAnimating) {
                                        setIsAnimating(true);
                                        setCurrentIndex(index);
                                        setTimeout(() => setIsAnimating(false), 300);
                                    }
                                }}
                                disabled={isAnimating}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Progress Indicator */}
            <div className="text-center mt-4">
                <p className="text-xs text-muted-foreground">
                    {currentIndex + 1} of {richPersonaAccounts.length}
                </p>
            </div>
        </div>
    );
}
