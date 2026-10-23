import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CurrencyInput from "../components/CurrencyInput";

describe("CurrencyInput", () => {
  it("renders with the provided value", () => {
    render(<CurrencyInput value="10.5" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("10.5");
  });

  it("calls onChange when the user types a valid amount", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "12.34" },
    });
    expect(onChange).toHaveBeenCalledWith("12.34");
  });

  it("rejects negative numbers", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "-5" },
    });
    expect(onChange).not.toHaveBeenCalledWith("-5");
  });

  it("rejects scientific notation", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "1e5" },
    });
    expect(onChange).not.toHaveBeenCalledWith("1e5");
  });

  it("accepts the maximum Int64 stroops amount", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "922337203685477.5807" },
    });
    expect(onChange).toHaveBeenCalledWith("922337203685477.5807");
  });

  it("preserves trailing zeroes in the emitted value", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "1.50" },
    });
    expect(onChange).toHaveBeenCalledWith("1.50");
  });

  it("fuzz: never emits negative or scientific-notation values", () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    const samples = ["-1", "-0.5", "1e10", "2E-3", "-1e5", "0", "0.00"];
    for (const sample of samples) {
      onChange.mockClear();
      fireEvent.change(input, { target: { value: sample } });
      for (const call of onChange.mock.calls) {
        const emitted = String(call[0]);
        expect(emitted.startsWith("-")).toBe(false);
        expect(/[eE]/.test(emitted)).toBe(false);
      }
    }
  });
});
