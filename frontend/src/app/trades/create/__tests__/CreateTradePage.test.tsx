import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateTradePage from "../page";

jest.mock("@stellar/stellar-sdk", () => ({
  StrKey: {
    isValidEd25519PublicKey: (address: string) =>
      address.startsWith("G") && address.length >= 40,
  },
}));

const VALID_SELLER = "GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI";

const setSearchParams = (params: Record<string, string>) => {
  const search = new URLSearchParams(params).toString();
  window.history.replaceState({}, "", `/trades/create${search ? `?${search}` : ""}`);
};

describe("CreateTradePage step gating", () => {
  beforeEach(() => {
    localStorage.clear();
    setSearchParams({});
  });

  it("blocks incomplete details and advances after valid details", async () => {
    const user = userEvent.setup();
    render(<CreateTradePage />);

    const continueButton = screen.getByRole("button", { name: /continue to negotiation/i });
    expect(continueButton).toBeDisabled();
    expect(screen.queryByLabelText(/delivery window/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/commodity/i), "Maize");
    await user.type(screen.getByLabelText(/quantity/i), "500");
    await user.type(screen.getByLabelText(/price per unit/i), "450");
    await user.type(
      screen.getByPlaceholderText(/g\.\.\./i),
      "GBRP4ZDXSS6NZPMTVNE7DZ47JNV7OFPJMIVG4FDCMNZP7CHH4656YEXI",
    );

    expect(continueButton).toBeEnabled();
    await user.click(continueButton);

    expect(screen.getByLabelText(/delivery window/i)).toBeInTheDocument();
  });
});

describe("CreateTradePage deep-link pre-population", () => {
  beforeEach(() => {
    localStorage.clear();
    setSearchParams({});
  });

  it("pre-fills Step 1 fields and shows the banner for valid query params", () => {
    setSearchParams({
      seller: VALID_SELLER,
      commodity: "Maize",
      amount: "500000",
    });

    render(<CreateTradePage />);

    expect(screen.getByText(/pre-filled from shared trade link/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/commodity/i)).toHaveValue("Maize");
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(500000);
    expect(screen.getByPlaceholderText(/g\.\.\./i)).toHaveValue(VALID_SELLER);
  });

  it("ignores invalid or malicious query params without throwing", () => {
    setSearchParams({
      seller: "<script>alert(1)</script>",
      commodity: "'; DROP TABLE trades; --",
      amount: "-999999999999999999999999",
    });

    expect(() => render(<CreateTradePage />)).not.toThrow();

    expect(screen.queryByText(/pre-filled from shared trade link/i)).not.toBeInTheDocument();

    expect(screen.getByLabelText(/commodity/i)).toHaveValue("");
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(null);
    expect(screen.getByPlaceholderText(/g\.\.\./i)).toHaveValue("");
  });

  it("ignores a non-numeric amount while still applying valid seller and commodity", () => {
    setSearchParams({
      seller: VALID_SELLER,
      commodity: "Maize",
      amount: "not-a-number",
    });

    expect(() => render(<CreateTradePage />)).not.toThrow();

    expect(screen.getByLabelText(/commodity/i)).toHaveValue("Maize");
    expect(screen.getByPlaceholderText(/g\.\.\./i)).toHaveValue(VALID_SELLER);
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(null);
  });
});