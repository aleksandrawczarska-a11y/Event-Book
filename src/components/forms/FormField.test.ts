import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormField } from "@/components/forms/FormField";
import * as FormFieldModule from "@/components/forms/FormField";

const icon = createElement("span");
const onChange = (_value: string) => undefined;

describe("FormField", () => {
  it("is a named export with no default", () => {
    expect(typeof FormField).toBe("function");
    expect(FormFieldModule.default).toBeUndefined();
  });

  it("associates the inquiry name label with an input", () => {
    const markup = renderToStaticMarkup(
      createElement(FormField, {
        id: "client_name",
        label: "Your name",
        value: "",
        onChange,
        icon,
      }),
    );

    expect(markup).toContain('for="client_name"');
    expect(markup).toContain("Your name");
    expect(markup).toContain("<input");
    expect(markup).not.toContain("<textarea");
  });

  it("renders the inquiry needs field as a textarea when multiline", () => {
    const markup = renderToStaticMarkup(
      createElement(FormField, {
        id: "needs_description",
        label: "What do you need?",
        value: "",
        onChange,
        icon,
        multiline: true,
      }),
    );

    expect(markup).toContain('for="needs_description"');
    expect(markup).toContain("What do you need?");
    expect(markup).toContain("<textarea");
    expect(markup).not.toContain("<input");
  });
});
