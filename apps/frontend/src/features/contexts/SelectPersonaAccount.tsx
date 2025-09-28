import { useState, useEffect, useRef, useCallback } from "react";
import { DisplayPersonaAccountCard } from "./DisplayPersonaAccountCard";
import { useBffAccountsListRichPersonaAccountsForUserApiBffAccountsPersonaAccountsRichGet } from "@/lib/api/generated";
import { usePersonaContextStore } from "@/store/persona-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectPersonaAccountProps {
    onSelect?: () => void;
    className?: string;
}

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
        console.log(richPersonaAccount)
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
                    Choose Account
                </h2>
                <p className="text-sm text-muted-foreground">
                    Select a persona account to continue
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
                        const isInjecting = injectingAccount === String(personaAccount.id);

                        // Convert RichPersonaAccountOut to DisplayPersonaAccountCard format
                        const displayPersonaAccount = {
                            id: personaAccount.id,
                            account_id: personaAccount.account_id,
                            persona_id: personaAccount.persona_id,
                            persona_name: personaAccount.persona_name,
                            persona_avatar_url: personaAccount.persona_avatar_url || undefined,
                            persona_description: personaAccount.persona_description || undefined,
                            account_handle: personaAccount.account_handle,
                            account_platform: personaAccount.account_platform,
                            account_avatar_url: personaAccount.account_avatar_url || undefined,
                            account_bio: personaAccount.account_bio || undefined,
                            is_active: personaAccount.is_active,
                            can_permissions: personaAccount.can_permissions,
                            is_verified_link: personaAccount.is_verified_link,
                            last_updated_at: personaAccount.last_updated_at || undefined,
                        };

                        return (
                            <div
                                key={personaAccount.id}
                                className="w-full flex-shrink-0 px-2"
                            >
                                <DisplayPersonaAccountCard
                                    personaAccount={displayPersonaAccount}
                                    onSelect={handleSelectPersonaAccount}
                                    isSelecting={isInjecting}
                                    prefersReducedMotion={prefersReducedMotion}
                                />
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
