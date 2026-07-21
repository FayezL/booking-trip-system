import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let mockIsDemo = false;
jest.mock("@/lib/env", () => ({
  __esModule: true,
  get isDemo() {
    return mockIsDemo;
  },
}));

import DemoBanner from "@/components/DemoBanner";

describe("DemoBanner", () => {
  beforeEach(() => {
    mockIsDemo = false;
  });

  it("renders nothing in production (isDemo false)", () => {
    const { container } = render(<DemoBanner />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Demo Environment/i)).not.toBeInTheDocument();
  });

  it("renders the demo notice when isDemo is true", () => {
    mockIsDemo = true;
    render(<DemoBanner />);
    expect(screen.getByText(/Demo Environment/i)).toBeInTheDocument();
    expect(screen.getByText(/fictional data/i)).toBeInTheDocument();
  });
});
