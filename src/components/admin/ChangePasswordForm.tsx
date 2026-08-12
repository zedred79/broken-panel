"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match");
      return;
    }

    setPending(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Unexpected error");
      setPending(false);
      return;
    }

    setSaved(true);
    // La sessione JWT attuale resterebbe valida anche dopo il cambio (il
    // token non codifica la password), quindi forziamo un nuovo login con
    // le nuove credenziali invece di lasciarla proseguire silenziosamente.
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h3 className="font-display text-lg tracking-wide">Change password</h3>
      <p className="mb-4 text-sm text-muted">
        After saving you&apos;ll need to sign in again with the new password.
      </p>

      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        {error && (
          <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-sm text-muted">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm text-muted">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm text-muted">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-5 py-2.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Change password"}
        </button>
        {saved && (
          <p className="text-sm text-green-400">
            Password changed ✓ — redirecting to login...
          </p>
        )}
      </form>
    </div>
  );
}
