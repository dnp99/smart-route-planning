import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { resolveApiBaseUrl } from './apiBaseUrl';
import RouteMap from './RouteMap';
import ThemeToggle from './ThemeToggle';
import type { OptimizeRouteResponse, Theme } from './types';

type OptimizeRouteErrorResponse = {
  error?: string;
};

const isOptimizeRouteResponse = (payload: unknown): payload is OptimizeRouteResponse => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const maybePayload = payload as Partial<OptimizeRouteResponse>;
  return (
    typeof maybePayload.totalDistanceKm === 'number' &&
    typeof maybePayload.start?.address === 'string' &&
    typeof maybePayload.end?.address === 'string' &&
    Array.isArray(maybePayload.orderedStops)
  );
};

const extractOptimizeRouteErrorMessage = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybePayload = payload as OptimizeRouteErrorResponse;
  return typeof maybePayload.error === 'string' ? maybePayload.error : null;
};

const resolveInitialTheme = (): Theme => {
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

function RoutePlanner() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [addressesText, setAddressesText] = useState('');
  const [destinationDraft, setDestinationDraft] = useState('');
  const [result, setResult] = useState<OptimizeRouteResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  const addressCount = useMemo(() => {
    return addressesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, [addressesText]);

  const addDestinationAddress = (address: string) => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      return;
    }

    setAddressesText((currentText) => {
      const existingAddresses = currentText
        .split('\n')
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean);

      if (existingAddresses.indexOf(trimmedAddress.toLowerCase()) !== -1) {
        return currentText;
      }

      if (!currentText.trim()) {
        return trimmedAddress;
      }

      return `${currentText.replace(/\s+$/, '')}\n${trimmedAddress}`;
    });

    setDestinationDraft('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setIsLoading(true);

    const addresses = addressesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const apiBaseUrl = resolveApiBaseUrl();

    fetch(`${apiBaseUrl}/api/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startAddress,
        endAddress,
        addresses,
      }),
    })
      .then((response) =>
        response
          .json()
          .then((payload) => ({
            response,
            payload,
          })),
      )
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(extractOptimizeRouteErrorMessage(payload) ?? 'Unable to optimize route.');
        }

        if (!isOptimizeRouteResponse(payload)) {
          throw new Error('Unexpected API response format.');
        }

        setResult(payload);
      })
      .catch((apiError) => {
        setError(apiError instanceof Error ? apiError.message : 'Something went wrong.');
      })
      .then(() => {
        setIsLoading(false);
      });
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <main className="mx-auto w-full max-w-4xl p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-bold text-slate-900 dark:text-slate-100">Smart Route Planner</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Enter your starting point, ending point, and destination addresses. The app returns a
              nearest-next-stop route with the ending point as the final stop.
            </p>
          </div>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <AddressAutocompleteInput
            id="startAddress"
            label="Starting point"
            placeholder="e.g. 1 Apple Park Way, Cupertino"
            value={startAddress}
            onChange={setStartAddress}
            helperText="Type at least 3 characters to see suggestions."
            required
          />

          <AddressAutocompleteInput
            id="endAddress"
            label="Ending point"
            placeholder="e.g. San Francisco International Airport"
            value={endAddress}
            onChange={setEndAddress}
            helperText="Type at least 3 characters to see suggestions."
            required
          />

          <AddressAutocompleteInput
            id="destinationAddressAutocomplete"
            label="Add destination with autocomplete"
            placeholder="Type destination and press Enter or click Add"
            value={destinationDraft}
            onChange={setDestinationDraft}
            onEnterKey={() => addDestinationAddress(destinationDraft)}
            helperText="Pick a suggestion, then press Enter or click Add destination."
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => addDestinationAddress(destinationDraft)}
              disabled={!destinationDraft.trim()}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Add destination
            </button>
          </div>

          <label htmlFor="addresses" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Destination addresses (one per line, optional)
          </label>
          <textarea
            id="addresses"
            placeholder={'1600 Amphitheatre Parkway, Mountain View\n1 Infinite Loop, Cupertino'}
            value={addressesText}
            rows={8}
            className="cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            readOnly
          />

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{addressCount} destination(s) detected</span>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isLoading ? 'Optimizing...' : 'Optimize Route'}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h2 className="m-0 text-lg font-semibold text-slate-900 dark:text-slate-100">Optimized Route</h2>

            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Start:</strong> {result.start.address}
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">End:</strong> {result.end.address}
            </p>

            <RouteMap start={result.start} orderedStops={result.orderedStops} />

            <ol className="mb-0 mt-2 list-decimal space-y-2 pl-5">
              {result.orderedStops.map((stop, index) => (
                <li key={`${stop.address}-${index}`} className="text-sm text-slate-800 dark:text-slate-200">
                  <span>{stop.address}</span>
                  <small className="block text-xs text-slate-500 dark:text-slate-400">
                    {stop.distanceFromPreviousKm} km from previous stop
                    {stop.isEndingPoint ? ' • ending point' : ''}
                  </small>
                </li>
              ))}
            </ol>

            <p className="mb-0 mt-3 text-sm text-slate-700 dark:text-slate-300">
              Total approximate distance:{' '}
              <strong className="text-slate-900 dark:text-slate-100">{result.totalDistanceKm} km</strong>
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

export default RoutePlanner;
