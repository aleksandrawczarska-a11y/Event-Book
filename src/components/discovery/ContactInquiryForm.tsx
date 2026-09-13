import React, { useState } from "react";
import { Calendar, Mail, MessageSquare, Phone, Send, User } from "lucide-react";

import { ServerError } from "@/components/auth/ServerError";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import type { ApiErrorBody } from "@/lib/api-error";

interface Props {
  decoratorProfileId: string;
  companyName: string;
}

interface FormState {
  client_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  needs_description: string;
  company_website: string;
}

const initialState: FormState = {
  client_name: "",
  client_email: "",
  client_phone: "",
  event_date: "",
  needs_description: "",
  company_website: "",
};

export default function ContactInquiryForm({ decoratorProfileId, companyName }: Props) {
  const [form, setForm] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      return Object.fromEntries(Object.entries(prev).filter(([field]) => field !== key));
    });
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decorator_profile_id: decoratorProfileId, ...form }),
      });

      // Honeypot short-circuit (204) is indistinguishable from success on purpose.
      if (response.status === 204 || response.ok) {
        setIsSubmitted(true);
        return;
      }

      const payload = (await response.json()) as ApiErrorBody;
      const apiError = payload.error;
      if (apiError.code === "VALIDATION_FAILED") {
        const fields = apiError.context.fields;
        if (fields && typeof fields === "object") {
          const nextErrors: Record<string, string> = {};
          for (const [key, message] of Object.entries(fields)) {
            if (typeof message === "string") {
              nextErrors[key] = message;
            }
          }
          setFieldErrors(nextErrors);
        }
        return;
      }
      setServerError(apiError.message);
    } catch {
      setServerError("Failed to send inquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div
        id="contact-inquiry-form"
        className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-emerald-100"
      >
        <p className="font-medium">Thanks — your inquiry was sent to {companyName}.</p>
        <p className="mt-1 text-sm text-emerald-100/80">
          They will reach out to you directly using the contact details you provided.
        </p>
      </div>
    );
  }

  return (
    <form
      id="contact-inquiry-form"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div className="flex items-center gap-2">
        <Send className="size-4 text-purple-300" />
        <h3 className="text-base font-semibold text-white">Send an inquiry</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="client_name"
          label="Your name"
          value={form.client_name}
          onChange={(value) => {
            updateField("client_name", value);
          }}
          placeholder="Anna Kowalska"
          error={fieldErrors.client_name}
          icon={<User className="size-4" />}
        />
        <FormField
          id="client_email"
          label="Your email"
          type="email"
          value={form.client_email}
          onChange={(value) => {
            updateField("client_email", value);
          }}
          placeholder="anna@example.com"
          error={fieldErrors.client_email}
          icon={<Mail className="size-4" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="client_phone"
          label="Phone (optional)"
          type="tel"
          value={form.client_phone}
          onChange={(value) => {
            updateField("client_phone", value);
          }}
          placeholder="+48 ..."
          error={fieldErrors.client_phone}
          icon={<Phone className="size-4" />}
        />
        <FormField
          id="event_date"
          label="Event date"
          type="date"
          value={form.event_date}
          onChange={(value) => {
            updateField("event_date", value);
          }}
          error={fieldErrors.event_date}
          icon={<Calendar className="size-4" />}
        />
      </div>

      <FormField
        id="needs_description"
        label="What do you need?"
        value={form.needs_description}
        onChange={(value) => {
          updateField("needs_description", value);
        }}
        placeholder="Describe your event and decoration needs"
        error={fieldErrors.needs_description}
        icon={<MessageSquare className="size-4" />}
        multiline
        rows={4}
      />

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Leave this field empty</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.company_website}
          onChange={(event) => {
            updateField("company_website", event.target.value);
          }}
        />
      </div>

      <ServerError message={serverError} />

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500 sm:w-auto"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="size-4" />
            Send inquiry
          </span>
        )}
      </Button>
    </form>
  );
}
