import "server-only";

// Read at request time so changing REGISTRATION_OPEN only needs a server restart,
// not a rebuild. Pages calling this must be dynamically rendered.
export function isRegistrationOpen() {
  return process.env.REGISTRATION_OPEN?.trim().toLowerCase() === "true";
}
