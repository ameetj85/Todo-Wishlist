# Auth Frontend (Next.js 15)

This project is a Next.js 15 App Router frontend for the Auth REST API at:

`C:\Users\Ameet\source\repos\__Claude\Auth-REST-API`

It uses:

- Tailwind CSS
- shadcn/ui components
- Server Actions for API calls

## Setup

1. Create environment file:

```bash
copy .env.example .env
```

2. Set your API base URL in `.env`:

```env
AUTH_API_BASE_URL=http://localhost:4000
```

3. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Implemented pages

- `/` Hero page with Login or Logout button based on auth state
- `/login` Login page with link to signup page
- `/signup` Signup page
- `/reset-password` Forgot password and reset password flows
- `/about` Protected page showing current user and session info

## Auth flow notes

- Login/signup server actions store API token in an HTTP-only cookie.
- Authenticated API calls use `Authorization: Bearer <token>`.
- Logout clears the API session and removes the cookie.
- About page redirects to `/login?next=/about` when not authenticated.
