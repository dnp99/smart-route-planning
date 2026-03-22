import { useEffect, useState } from "react";
import type { Patient } from "../../../../shared/contracts";
import { listPatients } from "../patients/patientService";

type UsePatientSearchOptions = {
  query: string;
  enabled: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;

export const usePatientSearch = ({
  query,
  enabled,
}: UsePatientSearchOptions) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setPatients([]);
      setIsLoading(false);
      setError("");
      return;
    }

    let isSubscribed = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextPatients = await listPatients(query);
        if (isSubscribed) {
          setPatients(nextPatients);
        }
      } catch (searchError) {
        if (isSubscribed) {
          setPatients([]);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Unable to load patients.",
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isSubscribed = false;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, query]);

  return {
    patients,
    isLoading,
    error,
  };
};
