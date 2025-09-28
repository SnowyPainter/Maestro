import { usePersonaContextStore } from "@/store/persona-context";
import { useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet } from "@/lib/api/generated";

export function usePersonaAccountValidity() {
    const { personaAccountId, accountId } = usePersonaContextStore();
    const hasPersona = personaAccountId !== null;
    const shouldCheckValidity = hasPersona && accountId !== null;

    const { data: isValidOut, isLoading, isError } = useBffAccountsIsValidPlatformAccountApiBffAccountsPlatformAccountIdIsValidGet(
        accountId || 0,
        {
            query: {
                enabled: shouldCheckValidity,
                staleTime: 300000, // 5 minutes
                refetchOnWindowFocus: true,
            }
        }
    );

    const isValid = shouldCheckValidity && !isLoading && !isError && isValidOut?.is_valid === true;
    const isActionDisabled = !isValid;
    
    let reason = "";
    // Always provide a reason if the action is disabled.
    if (isActionDisabled) {
        if (!hasPersona) {
            reason = "A Persona Account must be selected to perform this action.";
        } else if (accountId === null) {
            reason = "The selected Persona Account is not configured correctly (missing ID).";
        } else if (isLoading) {
            reason = "Validating Persona Account...";
        } else if (isError) {
            reason = "Could not validate the Persona Account.";
        } else if (isValidOut?.is_valid === false) {
            reason = "The Persona Account token is invalid. Please reconnect it from the context panel.";
        } else {
            // This is a catch-all for any other unexpected disabled state.
            reason = "Account status is being checked. Please wait.";
        }
    }

    return {
        hasPersona,
        isValid,
        isLoading: isLoading && shouldCheckValidity,
        isError,
        reason,
        isActionDisabled,
    };
}
