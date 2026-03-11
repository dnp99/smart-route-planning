import { useMemo, useState } from "react";

export const useDestinationAddresses = () => {
  const [addressesText, setAddressesText] = useState("");
  const [destinationDraft, setDestinationDraft] = useState("");

  const addressCount = useMemo(() => {
    return addressesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, [addressesText]);

  const destinationAddresses = useMemo(() => {
    return addressesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [addressesText]);

  const addDestinationAddress = (address: string) => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      return;
    }

    setAddressesText((currentText) => {
      const existingAddresses = currentText
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean);

      if (existingAddresses.indexOf(trimmedAddress.toLowerCase()) !== -1) {
        return currentText;
      }

      if (!currentText.trim()) {
        return trimmedAddress;
      }

      return `${currentText.replace(/\s+$/, "")}\n${trimmedAddress}`;
    });

    setDestinationDraft("");
  };

  const removeDestinationAddress = (indexToRemove: number) => {
    setAddressesText((currentText) =>
      currentText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((_, index) => index !== indexToRemove)
        .join("\n"),
    );
  };

  return {
    addressCount,
    destinationAddresses,
    destinationDraft,
    setDestinationDraft,
    addDestinationAddress,
    removeDestinationAddress,
  };
};
