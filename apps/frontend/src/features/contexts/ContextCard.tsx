import React, { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react"
import { useContextRegistryStore } from "@/store/chat-context-registry"

interface ContextCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  enabled: boolean;
  onToggle?: (checked: boolean) => void;
  toggleDisabled?: boolean;
  onClear?: () => void;
  clearDisabled?: boolean;
  helper?: string;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'persona';
  personaAvatarUrl?: string;
  accountHandle?: string;
  accountPlatform?: string;
  accountAvatarUrl?: string;
  isValid?: boolean;
  onReconnect?: () => void;
  isReconnecting?: boolean;
  platformGradient?: string;
  registryKeys?: string | string[];
}

export function ContextCard({
  icon: Icon,
  label,
  value,
  enabled,
  onToggle,
  toggleDisabled,
  onClear,
  clearDisabled,
  helper,
  className,
  onClick,
  variant = 'default',
  personaAvatarUrl,
  accountHandle,
  accountPlatform,
  accountAvatarUrl,
  isValid,
  onReconnect,
  isReconnecting,
  platformGradient,
  registryKeys,
}: ContextCardProps) {
  const clearRegistryKey = useContextRegistryStore((state) => state.clearKey)
  const normalizedKeys = useMemo(() =>
    registryKeys ? (Array.isArray(registryKeys) ? registryKeys : [registryKeys]) : [],
    [registryKeys]
  )
  const canRemove = Boolean(onClear && !clearDisabled) || normalizedKeys.length > 0

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenuPos(null), [])

  useEffect(() => {
    if (!menuPos) return
    const close = () => closeMenu()
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeMenu()
    window.addEventListener("click", close)
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("keydown", esc)
    }
  }, [menuPos, closeMenu])

  const clear = useCallback(() => {
    onClear?.()
    normalizedKeys.forEach(key => clearRegistryKey(key))
  }, [onClear, normalizedKeys, clearRegistryKey])

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (!canRemove) return
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  const menu = menuPos && createPortal(
    <div
      className="fixed z-50 min-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-lg"
      style={{ top: menuPos.y, left: menuPos.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
        onClick={() => {
          clear()
          closeMenu()
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        Remove context
      </button>
    </div>,
    document.body
  )

  if (variant === 'persona') {
    return (
      <>
        <div
          className={cn(
            "rounded-2xl border p-2 transition-colors relative overflow-hidden min-h-[80px] cursor-pointer hover:opacity-90",
            platformGradient ? "text-white" : "text-card-foreground",
            platformGradient || "bg-card border-primary/70",
            className
          )}
          onClick={onClick}
          onContextMenu={handleContextMenu}
        >
          <div className="grid grid-cols-2 gap-1 h-full">
            <div className="flex items-center justify-start">
              <Avatar className={cn(
                "h-7 w-7 shadow-sm",
                platformGradient ? "bg-white/20 border-2 border-white/30" : "bg-background",
                !platformGradient && (isValid ? "border-2 border-emerald-500" : "border border-border")
              )}>
                <AvatarImage src={personaAvatarUrl || ''} alt={value || ''} />
                <AvatarFallback className={cn("text-[10px] font-semibold", platformGradient ? "text-white" : "text-foreground")}>
                  {value?.charAt(0) || "P"}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center justify-end">
              {accountHandle && accountPlatform && (
                <div className="text-right">
                  <p className={cn("text-xs font-medium truncate", platformGradient ? "text-white/90" : "text-foreground")}>
                    @{accountHandle}
                  </p>
                  <p className={cn("text-[10px] text-muted-foreground truncate", platformGradient ? "text-white/70" : "text-muted-foreground")}>
                    {accountPlatform}
                  </p>
                </div>
              )}
            </div>

            <div className="col-span-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-xs font-medium truncate flex-1", platformGradient ? "text-white" : "text-foreground")}>
                  {value}
                </p>
                <div className={cn("h-2 w-2 rounded-full flex-shrink-0", enabled ? "bg-emerald-400" : "bg-red-400")} />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isValid === false && (
                    <div className={cn("flex items-center gap-1", platformGradient ? "text-white/90" : "text-destructive")}>
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Not Authenticated</span>
                    </div>
                  )}
                  {isValid && (
                    <div className={cn("flex items-center gap-1", platformGradient ? "text-white/90" : "text-emerald-600")}>
                      <span className="truncate">Authenticated</span>
                    </div>
                  )}
                </div>
                {onReconnect && (
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={onReconnect} disabled={isReconnecting}>
                    <RefreshCw className={cn("h-3 w-3", isReconnecting && "animate-spin")} />
                    <span className="hidden sm:inline">
                      {isReconnecting ? "..." : isValid === false ? "Fix" : "Refresh"}
                    </span>
                  </Button>
                )}
              </div>

            </div>
          </div>
        </div>
        {menu}
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border bg-card text-card-foreground p-2 transition-colors min-h-[60px] cursor-pointer hover:opacity-90",
          enabled ? "border-primary/60" : "border-border",
          className
        )}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted p-1 text-muted-foreground">
            <Icon className="h-3 w-3" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{value}</p>
              </div>
              <div className={cn("h-2 w-2 rounded-full flex-shrink-0", enabled ? "bg-emerald-500" : "bg-red-500")} />
            </div>
          </div>
        </div>
      </div>
      {menu}
    </>
  )
}
