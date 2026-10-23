import { act, fireEvent, render, screen } from "@testing-library/react";
import { WalletAddressBadge } from "../WalletAddressBadge";
import { getStellarExpertAccountUrl } from "../../../lib/links";

describe("WalletAddressBadge", () => {
  const address = "GBRPYHIL2CI3BFFWUW6A4HNE2ON4ZVQ4V4SZW4QFWK3DEMO1234";

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders truncated address with copy action", () => {
    render(<WalletAddressBadge address={address} showCopy showExplorer={false} />);

    expect(screen.getByText("GBRPYH...1234")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy wallet address")).toBeInTheDocument();
  });

  it("renders explorer URL for public network using links helper", () => {
    render(
      <WalletAddressBadge
        address={address}
        showCopy={false}
        showExplorer
        explorerNetwork="public"
      />,
    );

    const link = screen.getByLabelText("Open wallet in Stellar Expert");
    expect(link).toHaveAttribute("href", getStellarExpertAccountUrl(address, "public"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders explorer URL for testnet network using links helper", () => {
    render(
      <WalletAddressBadge
        address={address}
        showCopy={false}
        showExplorer
        explorerNetwork="testnet"
      />,
    );

    const link = screen.getByLabelText("Open wallet in Stellar Expert");
    expect(link).toHaveAttribute("href", getStellarExpertAccountUrl(address, "testnet"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("triggers clipboard write, announces copy, and clears checkmark after 2s", async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const { container } = render(
      <WalletAddressBadge address={address} showCopy showExplorer={false} />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy wallet address"));
    });

    expect(writeText).toHaveBeenCalledWith(address);

    // Checkmark visible and announcement made
    expect(container.querySelector(".text-emerald")).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("Address copied to clipboard");

    // After 2 seconds the checkmark and announcement clear
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(container.querySelector(".text-emerald")).not.toBeInTheDocument();
    expect(liveRegion).toHaveTextContent("");
  });
});
