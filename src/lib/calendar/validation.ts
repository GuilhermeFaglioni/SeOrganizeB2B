export function normalizeAttendeeEmails(emails: string[]): string[] {
  const normalized = Array.from(
    new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))
  );
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const email of normalized) {
    if (!emailPattern.test(email)) {
      throw new Error(`Invalid attendee email: ${email}`);
    }
  }

  return normalized;
}
