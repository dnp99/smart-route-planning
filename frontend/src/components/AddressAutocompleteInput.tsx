import { useEffect, useId, useMemo, useState } from 'react';
import { resolveApiBaseUrl } from './apiBaseUrl';
import type { AddressSuggestion } from './types';

type AddressAutocompleteResponse = {
  suggestions?: unknown;
  error?: string;
};

type AddressAutocompleteInputProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  required?: boolean;
  helperText?: string;
  onChange: (value: string) => void;
  onEnterKey?: () => void;
};

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 5;
const AUTOCOMPLETE_DEBOUNCE_MS = 500;

const isAddressSuggestion = (value: unknown): value is AddressSuggestion => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AddressSuggestion>;
  return (
    typeof candidate.displayName === 'string' &&
    typeof candidate.lat === 'number' &&
    typeof candidate.lon === 'number'
  );
};

const extractSuggestions = (payload: unknown): AddressSuggestion[] => {
  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  const response = payload as AddressAutocompleteResponse;
  if (!Array.isArray(response.suggestions)) {
    return [];
  }

  return response.suggestions.filter(isAddressSuggestion).slice(0, MAX_SUGGESTIONS);
};

function AddressAutocompleteInput({
  id,
  label,
  placeholder,
  value,
  required = false,
  helperText,
  onChange,
  onEnterKey,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const datalistId = useId();

  const shouldSearch = value.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!shouldSearch) {
      setSuggestions([]);
      setIsLoading(false);
      setError('');
      return;
    }

    const query = value.trim();
    const controller = new AbortController();
    let isSubscribed = true;

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError('');

      try {
        const apiBaseUrl = resolveApiBaseUrl();
        const params = new URLSearchParams({ query });
        const response = await fetch(`${apiBaseUrl}/api/address-autocomplete?${params}`, {
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as AddressAutocompleteResponse | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load address suggestions.');
        }

        if (isSubscribed) {
          setSuggestions(extractSuggestions(payload));
        }
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return;
        }

        if (isSubscribed) {
          setSuggestions([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load address suggestions.');
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      isSubscribed = false;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [shouldSearch, value]);

  const suggestionNames = useMemo(() => suggestions.map((item) => item.displayName), [suggestions]);

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type="text"
        list={datalistId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnterKey) {
            event.preventDefault();
            onEnterKey();
          }
        }}
        className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        required={required}
      />
      <datalist id={datalistId}>
        {suggestionNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {helperText && <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}

      {isLoading && <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Loading suggestions…</p>}

      {!isLoading && error && (
        <p className="m-0 text-xs text-amber-700 dark:text-amber-300">{error}</p>
      )}
    </div>
  );
}

export default AddressAutocompleteInput;
