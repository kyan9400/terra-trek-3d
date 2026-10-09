/* Small inline icons, drawn for this project. */

export function Logo() {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 16h22M16 5c-4 5-4 17 0 22M16 5c4 5 4 17 0 22" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
      <path d="M4 22C9 8 23 6 29 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="29" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 12.5l5 5L20 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlaneIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"
        fill="currentColor"
      />
    </svg>
  );
}
