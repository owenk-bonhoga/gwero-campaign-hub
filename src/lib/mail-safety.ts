export function safeHeader(value: string, label = "Email header"): string {
  if (typeof value !== "string" || /[\r\n]/.test(value) || value.includes(String.fromCharCode(0)))
    throw new Error(`${label} contains invalid control characters.`);
  return value;
}

export function safeAddress(value: string): string {
  safeHeader(value, "Email address");
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)) throw new Error("Invalid email address.");
  return value;
}
