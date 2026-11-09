"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { inputClass } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/admin";
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm text-cream">Имейл</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className={inputClass()}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm text-cream">Парола</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass()} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-oxblood-bright">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full" })}>
        {pending ? "Влизане…" : "Влез"}
      </button>
    </form>
  );
}
