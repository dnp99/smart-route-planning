import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDestinationAddresses } from "../../components/hooks/useDestinationAddresses";

describe("useDestinationAddresses", () => {
  it("starts with no destinations", () => {
    const { result } = renderHook(() => useDestinationAddresses());

    expect(result.current.addressCount).toBe(0);
    expect(result.current.destinationAddresses).toEqual([]);
    expect(result.current.destinationDraft).toBe("");
  });

  it("adds destinations, deduplicates by case-insensitive match, and trims", () => {
    const { result } = renderHook(() => useDestinationAddresses());

    act(() => {
      result.current.setDestinationDraft("  Stop One  ");
      result.current.addDestinationAddress("  Stop One  ");
      result.current.setDestinationDraft("stop one");
      result.current.addDestinationAddress("stop one");
      result.current.addDestinationAddress("Stop Two");
    });

    expect(result.current.addressCount).toBe(2);
    expect(result.current.destinationAddresses).toEqual(["Stop One", "Stop Two"]);
    expect(result.current.destinationDraft).toBe("");
  });

  it("ignores blank destination input", () => {
    const { result } = renderHook(() => useDestinationAddresses());

    act(() => {
      result.current.addDestinationAddress("   ");
    });

    expect(result.current.addressCount).toBe(0);
    expect(result.current.destinationAddresses).toEqual([]);
  });

  it("removes destination by index", () => {
    const { result } = renderHook(() => useDestinationAddresses());

    act(() => {
      result.current.addDestinationAddress("Stop One");
      result.current.addDestinationAddress("Stop Two");
      result.current.addDestinationAddress("Stop Three");
      result.current.removeDestinationAddress(1);
    });

    expect(result.current.destinationAddresses).toEqual(["Stop One", "Stop Three"]);
    expect(result.current.addressCount).toBe(2);
  });
});
