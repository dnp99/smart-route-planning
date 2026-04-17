export const CURRENT_LEGAL_NOTICE_VERSION = "2026-04-16";

export const isLegalNoticeAcknowledgementRequired = (
  acceptedVersion: string | null | undefined,
): boolean => {
  return acceptedVersion !== CURRENT_LEGAL_NOTICE_VERSION;
};
