import { t } from "@/lib/i18n";
import {
  formatNaira,
  formatMoney,
  formatNumber,
  formatDate,
  formatRelativeTime,
} from "@/lib/i18n/format";
import { pseudoLocalize } from "@/lib/i18n/pseudo";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, Fragment } from "react";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";
import { setActiveLocale, localeDirection } from "@/lib/i18n/config";

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  return createElement(
    Fragment,
    null,
    createElement("span", null, locale),
    createElement("span", null, t("common.retry")),
    createElement("button", { onClick: () => setLocale("ha-NG") }, "Choose Hausa"),
  );
}

afterEach(() => {
  setActiveLocale(undefined);
  window.localStorage.clear();
});

describe("formatNaira", () => {
  it("renders NGN as ₦1,234.56", () => {
    expect(formatNaira(1234.56)).toBe("₦1,234.56");
  });

  it("accepts string amounts", () => {
    expect(formatNaira("1000")).toBe("₦1,000.00");
  });

  it("groups large amounts", () => {
    expect(formatNaira(2_500_000)).toBe("₦2,500,000.00");
  });

  it("throws on non-numeric input", () => {
    expect(() => formatNaira("not-a-number")).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  it("honours an explicit currency", () => {
    expect(formatMoney(1234.56, { currency: "USD", locale: "en-US" })).toBe("$1,234.56");
  });
});

describe("formatNumber", () => {
  it("groups with the en-NG locale", () => {
    expect(formatNumber(1234567.89, { maximumFractionDigits: 2 })).toBe("1,234,567.89");
  });

  it("supports fixed decimal precision through the shared helper", () => {
    expect(
      formatNumber(1234.5, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe("1,234.50");
  });
});

describe("formatDate", () => {
  it("uses day-month-year order for en-NG", () => {
    expect(formatDate(new Date("2026-08-29T12:00:00Z"), { locale: "en-NG" })).toBe(
      "29 Aug 2026",
    );
  });
});

describe("formatRelativeTime", () => {
  it("describes the past", () => {
    const now = new Date("2026-08-29T12:00:00Z");
    const earlier = new Date("2026-08-26T12:00:00Z");
    expect(formatRelativeTime(earlier, { now, locale: "en-US" })).toBe("3 days ago");
  });
});

describe("t()", () => {
  it("resolves a catalog key", () => {
    expect(t("common.retry")).toBe("Retry");
  });

  it("interpolates params", () => {
    expect(t("wallet.wrongNetworkCta", { expected: "Testnet" })).toBe("Switch to Testnet");
  });

  it("returns the key when missing", () => {
    // @ts-expect-error deliberately unknown key
    expect(t("does.not.exist")).toBe("does.not.exist");
  });

  it("pseudo-localizes when locale is pseudo", () => {
    const out = t("common.retry", { locale: "pseudo" });
    expect(out).toMatch(/^⟦/);
    expect(out).toContain("Ŕéţŕý");
  });

  it("uses translated catalogs for supported Nigerian languages", () => {
    expect(t("common.retry", { locale: "ha-NG" })).toBe("Sake gwadawa");
    expect(t("common.retry", { locale: "yo-NG" })).toBe("Gbìyànjú lẹ́ẹ̀kansi");
    expect(t("common.retry", { locale: "ig-NG" })).toBe("Nwaa ọzọ");
  });

  it("persists locale selection and applies it to the document", async () => {
    const user = userEvent.setup();
    render(createElement(LocaleProvider, null, createElement(LocaleProbe)));

    await user.click(screen.getByRole("button", { name: "Choose Hausa" }));

    await waitFor(() => {
      expect(screen.getByText("ha-NG")).toBeInTheDocument();
      expect(screen.getByText("Sake gwadawa")).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("ha-NG");
      expect(document.documentElement.dir).toBe("ltr");
      expect(window.localStorage.getItem("amana-locale")).toBe("ha-NG");
    });
  });

  it("restores the saved locale after hydration", async () => {
    window.localStorage.setItem("amana-locale", "yo-NG");
    render(createElement(LocaleProvider, null, createElement(LocaleProbe)));

    await waitFor(() => {
      expect(screen.getByText("yo-NG")).toBeInTheDocument();
      expect(screen.getByText("Gbìyànjú lẹ́ẹ̀kansi")).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("yo-NG");
      expect(document.documentElement.dir).toBe("ltr");
    });
  });
});

describe("localeDirection", () => {
  it("defaults to ltr for Nigerian and Western locales", () => {
    expect(localeDirection("en-NG")).toBe("ltr");
    expect(localeDirection("en-US")).toBe("ltr");
    expect(localeDirection("ha-NG")).toBe("ltr");
    expect(localeDirection("yo-NG")).toBe("ltr");
    expect(localeDirection("ig-NG")).toBe("ltr");
    expect(localeDirection("pseudo")).toBe("ltr");
  });

  it("returns rtl for right-to-left locales or Arabic script variants", () => {
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("ha-Arab")).toBe("rtl");
    expect(localeDirection("he")).toBe("rtl");
    expect(localeDirection("ur")).toBe("rtl");
  });
});

describe("pseudoLocalize", () => {
  it("preserves ICU placeholders", () => {
    expect(pseudoLocalize("Hello {name}")).toContain("{name}");
  });

  it("pads the string so truncation is visible", () => {
    expect(pseudoLocalize("Save").length).toBeGreaterThan("Save".length);
  });
});
