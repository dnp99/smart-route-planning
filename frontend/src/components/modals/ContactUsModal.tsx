import { useState, type FormEvent } from "react";
import { SUPPORT_EMAIL } from "../../constants/support";
import { responsiveStyles } from "../responsiveStyles";

type ContactUsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const buildSupportMailto = (subject: string, body: string) => {
  const params = new URLSearchParams({
    subject: subject.trim(),
    body: body.trim(),
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
};

export default function ContactUsModal({ isOpen, onClose }: ContactUsModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isMessageReady, setIsMessageReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!trimmedSubject || !trimmedBody) {
      setError("Subject and message are required.");
      return;
    }

    setError("");
    setCopyStatus("");
    setIsMessageReady(true);
  };

  const handleClose = () => {
    setError("");
    setCopyStatus("");
    setIsMessageReady(false);
    onClose();
  };

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  const mailtoHref = buildSupportMailto(trimmedSubject, trimmedBody);
  const composedMessage = `To: ${SUPPORT_EMAIL}\nSubject: ${trimmedSubject}\n\n${trimmedBody}`;

  const handleCopy = () => {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus("Copy is not available in this browser.");
      return;
    }

    void navigator.clipboard
      .writeText(composedMessage)
      .then(() => setCopyStatus("Message copied."))
      .catch(() => setCopyStatus("Unable to copy message."));
  };

  return (
    <div className={responsiveStyles.modalBackdrop} onClick={handleClose}>
      <div
        className={`${responsiveStyles.modalSurface} max-w-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-us-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="contact-us-title"
              className="m-0 text-xl font-semibold text-slate-900 dark:text-slate-100"
            >
              Contact Us
            </h2>
            <p className="m-0 mt-2 text-sm text-slate-600 dark:text-slate-300">
              Send a message to Routefy support.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close contact form"
            onClick={handleClose}
            className={responsiveStyles.legalDocumentModalCloseButton}
          >
            ×
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label htmlFor="contact-subject" className="grid gap-1">
            <span className={responsiveStyles.formLabel}>Subject</span>
            <input
              id="contact-subject"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setIsMessageReady(false);
              }}
              className={responsiveStyles.formInput}
              autoComplete="off"
            />
          </label>

          <label htmlFor="contact-message" className="grid gap-1">
            <span className={responsiveStyles.formLabel}>Message</span>
            <textarea
              id="contact-message"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setIsMessageReady(false);
              }}
              className={`${responsiveStyles.formInput} min-h-36 resize-y`}
            />
          </label>

          {error && (
            <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {isMessageReady && (
            <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-200">
              <p className="m-0">
                Your message is ready. If your email app does not open, copy the message and send it
                to <span className="font-semibold">{SUPPORT_EMAIL}</span>.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={mailtoHref}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Open email app
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Copy message
                </button>
              </div>
              {copyStatus && (
                <p className="m-0 text-xs text-slate-600 dark:text-slate-300">{copyStatus}</p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button type="submit" className={responsiveStyles.primaryButton}>
              Prepare message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
