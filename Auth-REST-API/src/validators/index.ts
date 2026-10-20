// Inputs come straight from request bodies, so they are typed as unknown.

export function validateEmail(email: unknown): string | null {
  if (!email || typeof email !== 'string') return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Invalid email address';
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 8)     return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function validateName(name: unknown): string | null {
  if (!name || typeof name !== 'string') return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  if (name.trim().length > 100) return 'Name must be 100 characters or fewer';
  return null;
}

export function validateSignup({
  email,
  password,
  name,
}: {
  email: unknown;
  password: unknown;
  name: unknown;
}): string | null {
  return (
    validateEmail(email) ||
    validatePassword(password) ||
    validateName(name) ||
    null
  );
}

export function validateLogin({
  email,
  password,
}: {
  email: unknown;
  password: unknown;
}): string | null {
  if (!email) return 'email is required';
  if (!password) return 'password is required';
  return null;
}
