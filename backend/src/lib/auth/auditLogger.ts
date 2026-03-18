type AuthAuditEvent = {
  action: "login";
  outcome:
    | "success"
    | "invalid_json"
    | "invalid_payload"
    | "invalid_credentials"
    | "rate_limited"
    | "transport_rejected"
    | "error";
  email?: string;
  clientKey: string;
};

const maskEmail = (email?: string) => {
  if (!email) {
    return undefined;
  }

  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) {
    return "***";
  }

  const localPrefix = local[0] ?? "*";
  return `${localPrefix}***@${domain}`;
};

const maskClientKey = (clientKey: string) => {
  const normalized = clientKey.trim();
  if (!normalized || normalized === "anonymous") {
    return "anonymous";
  }

  if (normalized.indexOf(".") !== -1) {
    const octets = normalized.split(".");
    if (octets.length === 4) {
      return `${octets[0]}.${octets[1]}.x.x`;
    }
  }

  if (normalized.indexOf(":") !== -1) {
    const segments = normalized.split(":");
    return `${segments.slice(0, 2).join(":")}:x:x`;
  }

  return "***";
};

export const logAuthAuditEvent = (event: AuthAuditEvent) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const payload = {
    event: "auth.login",
    outcome: event.outcome,
    email: maskEmail(event.email),
    client: maskClientKey(event.clientKey),
    timestamp: new Date().toISOString(),
  };

  console.info(JSON.stringify(payload));
};
