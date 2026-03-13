import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const optimizeRouteMock = vi.fn();
const usePatientSearchMock = vi.fn<
  (args: { enabled: boolean }) => {
    patients: unknown[];
    isLoading: boolean;
    error: string;
  }
>(() => ({
  patients: [],
  isLoading: false,
  error: "",
}));

vi.mock("../../components/routePlanner/useRouteOptimization", () => ({
  useRouteOptimization: () => ({
    result: null,
    error: "",
    isLoading: false,
    showOptimizeSuccess: false,
    hasAttemptedOptimize: false,
    optimizeRoute: optimizeRouteMock,
  }),
}));

vi.mock("../../components/routePlanner/usePatientSearch", () => ({
  usePatientSearch: (args: { enabled: boolean }) => usePatientSearchMock(args),
}));

vi.mock("../../components/AddressAutocompleteInput", () => ({
  default: ({
    id,
    label,
    value,
    onChange,
    onSuggestionPick,
    disabled,
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSuggestionPick?: (suggestion: { displayName: string; placeId: string }) => void;
    disabled?: boolean;
  }) => {
    const suggestion =
      id === "startAddress"
        ? {
            displayName: "3361 Ingram Road, Mississauga, ON",
            placeId: "start-place",
          }
        : {
            displayName: "6625 Snow Goose Lane, Mississauga, ON",
            placeId: "end-place",
          };

    return (
      <div>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          value={value}
          disabled={Boolean(disabled)}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
        />
        {onSuggestionPick && (
          <button
            type="button"
            disabled={Boolean(disabled)}
            onClick={() => {
              onChange(suggestion.displayName);
              onSuggestionPick(suggestion);
            }}
          >
            Pick {label}
          </button>
        )}
      </div>
    );
  },
}));

vi.mock("../../components/ThemeToggle", () => ({
  default: () => null,
}));

vi.mock("../../components/RouteMap", () => ({
  default: () => null,
}));

vi.mock("../../components/routePlanner/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

import RoutePlanner from "../../components/RoutePlanner";

const janePatient = {
  id: "patient-1",
  nurseId: "nurse-1",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Main St",
  googlePlaceId: "place-1",
  preferredVisitStartTime: "09:00:00",
  preferredVisitEndTime: "11:00:00",
  visitTimeType: "fixed" as const,
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

const johnPatient = {
  id: "patient-2",
  nurseId: "nurse-1",
  firstName: "John",
  lastName: "Smith",
  address: "456 Queen St",
  googlePlaceId: null,
  preferredVisitStartTime: "10:00:00",
  preferredVisitEndTime: "12:00:00",
  visitTimeType: "flexible" as const,
  createdAt: "2026-03-12T12:00:00.000Z",
  updatedAt: "2026-03-12T12:00:00.000Z",
};

describe("RoutePlanner patient selection integration", () => {
  beforeEach(() => {
    optimizeRouteMock.mockReset();
    usePatientSearchMock.mockReset();
    usePatientSearchMock.mockImplementation(({ enabled }: { enabled: boolean }) => ({
      patients: enabled ? [janePatient, johnPatient] : [],
      isLoading: false,
      error: "",
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("adds destination patients and prevents duplicate selection", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByText("1 destination(s) detected")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /Jane Doe/i })).toHaveLength(0);
  });

  it("promotes selected destination patient to end patient and removes from destinations", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByLabelText("Patient end address"));
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);

    expect(screen.getByText("End patient: Jane Doe")).toBeTruthy();
    expect(screen.getByText("0 destination(s) detected")).toBeTruthy();
  });

  it("submits optimize payload with patient-linked destinations", () => {
    render(<RoutePlanner />);

    fireEvent.change(screen.getByLabelText("Ending point"), {
      target: { value: "Airport" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "Airport",
      destinations: [
        {
          patientId: "patient-2",
          patientName: "John Smith",
          address: "456 Queen St",
          googlePlaceId: null,
        },
      ],
      canOptimize: true,
    });
  });

  it("includes the selected end patient in optimize destinations", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByLabelText("Patient end address"));
    fireEvent.click(screen.getAllByRole("button", { name: /Jane Doe/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      endAddress: "123 Main St",
      destinations: [
        {
          patientId: "patient-1",
          patientName: "Jane Doe",
          address: "123 Main St",
          googlePlaceId: "place-1",
        },
      ],
      canOptimize: true,
    });
  });

  it("submits manual start and end place ids picked from autocomplete", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Pick Starting point" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Ending point" }));
    fireEvent.click(screen.getByRole("button", { name: "Optimize Route" }));

    expect(optimizeRouteMock).toHaveBeenCalledWith({
      startAddress: "3361 Ingram Road, Mississauga, ON",
      startGooglePlaceId: "start-place",
      endAddress: "6625 Snow Goose Lane, Mississauga, ON",
      endGooglePlaceId: "end-place",
      destinations: [],
      canOptimize: true,
    });
  });

  it("removes selected destination patient from planner state", () => {
    render(<RoutePlanner />);

    fireEvent.click(screen.getAllByRole("button", { name: /John Smith/i })[0]);
    expect(screen.getByText("1 destination(s) detected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("0 destination(s) detected")).toBeTruthy();
    expect(screen.getByText("No destination patients selected yet.")).toBeTruthy();
  });
});
