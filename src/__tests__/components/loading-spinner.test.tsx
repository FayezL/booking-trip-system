import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import LoadingSpinner from "@/components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders spinner SVG", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders text when provided", () => {
    render(<LoadingSpinner text="Loading..." />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("does not render text when not provided", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});
