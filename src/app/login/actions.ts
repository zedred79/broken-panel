"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function loginAction(
  _prevState: string | undefined,
  formData: FormData
) {
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.message.startsWith("rate-limited")) {
        return "Troppi tentativi falliti. Riprova tra qualche minuto.";
      }
      return "Email o password non validi.";
    }
    throw error;
  }
}
