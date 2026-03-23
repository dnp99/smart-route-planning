import { useEffect, useMemo, useState } from "react";
import type { RoutePlannerDraft } from "../routePlanner/routePlannerDraft";
import type { AddressSuggestion } from "../types";

const DEFAULT_START_ADDRESS = "3361 Ingram Road, Mississauga, ON";

type UseRoutePlannerAddressesParams = {
  initialDraft: RoutePlannerDraft | null;
  normalizedHomeAddress: string;
  hasAttemptedOptimize: boolean;
};

export function useRoutePlannerAddresses({
  initialDraft,
  normalizedHomeAddress,
  hasAttemptedOptimize,
}: UseRoutePlannerAddressesParams) {
  const [startAddress, setStartAddress] = useState(
    initialDraft?.startAddress ??
      (normalizedHomeAddress.length > 0 ? normalizedHomeAddress : DEFAULT_START_ADDRESS),
  );
  const [manualEndAddress, setManualEndAddress] = useState(
    initialDraft?.manualEndAddress ?? normalizedHomeAddress,
  );
  const [startGooglePlaceId, setStartGooglePlaceId] = useState<string | null>(
    initialDraft?.startGooglePlaceId ?? null,
  );
  const [manualEndGooglePlaceId, setManualEndGooglePlaceId] = useState<string | null>(
    initialDraft?.manualEndGooglePlaceId ?? null,
  );
  const [startTouched, setStartTouched] = useState(false);
  const [endTouched, setEndTouched] = useState(false);

  // Sync home address into start/end when no draft exists
  useEffect(() => {
    if (initialDraft) return;
    if (normalizedHomeAddress.length === 0) return;

    if (startAddress.trim().length === 0 || startAddress === DEFAULT_START_ADDRESS) {
      setStartAddress(normalizedHomeAddress);
      setStartGooglePlaceId(null);
    }

    if (manualEndAddress.trim().length === 0) {
      setManualEndAddress(normalizedHomeAddress);
      setManualEndGooglePlaceId(null);
    }
  }, [initialDraft, manualEndAddress, normalizedHomeAddress, startAddress]);

  const handleStartAddressChange = (value: string) => {
    setStartAddress(value);
    setStartGooglePlaceId(null);
  };

  const handleStartAddressPick = (suggestion: AddressSuggestion) => {
    setStartAddress(suggestion.displayName);
    setStartGooglePlaceId(suggestion.placeId);
  };

  const handleManualEndAddressChange = (value: string) => {
    setManualEndAddress(value);
    setManualEndGooglePlaceId(null);
  };

  const handleManualEndAddressPick = (suggestion: AddressSuggestion) => {
    setManualEndAddress(suggestion.displayName);
    setManualEndGooglePlaceId(suggestion.placeId);
  };

  const resolvedEndAddress = manualEndAddress;
  const resolvedEndGooglePlaceId = manualEndGooglePlaceId;
  const canOptimize = startAddress.trim().length > 0 && resolvedEndAddress.trim().length > 0;
  const hasValidTripAddresses = canOptimize;

  const startFieldError =
    (hasAttemptedOptimize || startTouched) && startAddress.trim().length === 0
      ? "Starting point is required."
      : undefined;

  const endFieldError = useMemo(() => {
    if (!(hasAttemptedOptimize || endTouched)) return undefined;
    if (manualEndAddress.trim().length === 0) return "Ending point is required.";
    return undefined;
  }, [endTouched, hasAttemptedOptimize, manualEndAddress]);

  const optimizeEndpointHint = useMemo(() => {
    if (manualEndAddress.trim().length === 0) {
      return "Select an ending point to enable route optimization.";
    }
    return undefined;
  }, [manualEndAddress]);

  return {
    startAddress,
    manualEndAddress,
    startGooglePlaceId,
    manualEndGooglePlaceId,
    startTouched,
    endTouched,
    setStartTouched,
    setEndTouched,
    handleStartAddressChange,
    handleStartAddressPick,
    handleManualEndAddressChange,
    handleManualEndAddressPick,
    resolvedEndAddress,
    resolvedEndGooglePlaceId,
    canOptimize,
    hasValidTripAddresses,
    startFieldError,
    endFieldError,
    optimizeEndpointHint,
  };
}
