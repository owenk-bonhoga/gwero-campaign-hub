import { Mail } from "lucide-react";

export function MailProviderLogo({ providerId }: { providerId: string }) {
  const frame = "grid size-12 shrink-0 place-items-center rounded-xl border bg-white shadow-sm";
  if (providerId === "google-workspace")
    return (
      <span className={frame} aria-hidden="true">
        <svg viewBox="0 0 48 48" className="size-8">
          <path
            fill="#FFC107"
            d="M43.611 20H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-4Z"
          />
          <path
            fill="#FF3D00"
            d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.347 4.337-17.694 10.691Z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
          />
          <path
            fill="#1976D2"
            d="M43.611 20H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.226 44 34 44 24c0-1.341-.138-2.65-.389-4Z"
          />
        </svg>
      </span>
    );
  if (providerId === "gmail")
    return (
      <span className={frame} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-8" fill="#EA4335">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457Z" />
        </svg>
      </span>
    );
  if (providerId === "microsoft-365" || providerId === "outlook")
    return (
      <span className={frame} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-8">
          <path fill="#F25022" d="M1 1h10v10H1z" />
          <path fill="#7FBA00" d="M13 1h10v10H13z" />
          <path fill="#00A4EF" d="M1 13h10v10H1z" />
          <path fill="#FFB900" d="M13 13h10v10H13z" />
        </svg>
      </span>
    );
  if (providerId === "yahoo")
    return (
      <span className={frame} aria-hidden="true">
        <span className="-skew-x-6 text-xl font-black tracking-tighter text-[#6001D2]">yahoo!</span>
      </span>
    );
  if (providerId === "zoho")
    return (
      <span className={frame} aria-hidden="true">
        <span className="flex -rotate-3 text-[10px] font-black text-white">
          <span className="bg-[#E42527] p-1">Z</span>
          <span className="bg-[#F9B21D] p-1">O</span>
          <span className="bg-[#21A366] p-1">H</span>
          <span className="bg-[#1686D9] p-1">O</span>
        </span>
      </span>
    );
  if (providerId === "icloud")
    return (
      <span className={frame} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-8" fill="#3693F3">
          <path d="M13.762 4.29a6.51 6.51 0 0 0-5.669 3.332 3.571 3.571 0 0 0-1.558-.36 3.571 3.571 0 0 0-3.516 3A4.918 4.918 0 0 0 0 14.796a4.918 4.918 0 0 0 4.92 4.914 4.93 4.93 0 0 0 .617-.045h14.42c2.305-.272 4.041-2.258 4.043-4.589v-.009a4.594 4.594 0 0 0-3.727-4.508 6.51 6.51 0 0 0-6.511-6.27Z" />
        </svg>
      </span>
    );
  if (providerId === "fastmail")
    return (
      <span className={frame} aria-hidden="true">
        <svg viewBox="0 0 40 40" className="size-9">
          <circle cx="20" cy="20" r="16" fill="#fff" />
          <path d="m20 20-8.333-5.73v11.458l5.208-1.563L20 20Z" fill="#FFC107" />
          <path
            d="M11.667 25.73h15.625c.575 0 1.041-.467 1.041-1.042V14.272L11.667 25.73Z"
            fill="#1b1e20"
          />
          <path
            d="M32.871 11.151A15.56 15.56 0 0 1 35.623 20c0 8.629-6.996 15.626-15.625 15.626A15.61 15.61 0 0 1 7.127 28.85l-3.603 2.478A19.98 19.98 0 0 0 20 40c11.045 0 20-8.955 20-20a19.9 19.9 0 0 0-3.524-11.327l-3.605 2.478Z"
            fill="#69B3E7"
          />
          <path
            d="M4.375 20C4.375 11.371 11.371 4.375 20 4.375A15.61 15.61 0 0 1 32.871 11.15l3.604-2.478A19.98 19.98 0 0 0 20 0C8.955 0 0 8.955 0 20c0 4.207 1.305 8.105 3.524 11.327l3.603-2.478A15.56 15.56 0 0 1 4.375 20Z"
            fill="#0067B9"
          />
        </svg>
      </span>
    );
  return (
    <span className={frame} aria-hidden="true">
      <Mail className="size-7 text-primary" />
    </span>
  );
}
