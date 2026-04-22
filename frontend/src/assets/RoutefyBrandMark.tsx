type RoutefyBrandMarkProps = {
  className?: string;
};

export default function RoutefyBrandMark({ className }: RoutefyBrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="11.5" r="6.1" />
      <path d="M12 5.4v6.1" />
      <path d="M12 11.5 7.03 14.37" />
      <path d="M12 11.5l4.97 2.87" />
      <circle cx="12" cy="11.5" r="2.05" fill="currentColor" strokeWidth="0" />
      <circle cx="12" cy="2.3" r="1.65" fill="currentColor" strokeWidth="0" />
      <circle cx="4.5" cy="15.95" r="1.65" fill="currentColor" strokeWidth="0" />
      <circle cx="19.5" cy="15.95" r="1.65" fill="currentColor" strokeWidth="0" />
    </svg>
  );
}
