"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(
    loginAction,
    undefined
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo-mark.svg" alt="" className="h-16 w-auto" />
          <h1 className="font-display mt-4 text-2xl tracking-wide">
            ADMIN AREA
          </h1>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-lg border border-border bg-surface p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm text-muted"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm text-muted"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-accent">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-accent py-2.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
