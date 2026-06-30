import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "@/app/signup/page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "ar" }),
}));

jest.mock("@/components/LanguageToggle", () => {
  return function MockLanguageToggle() {
    return <div data-testid="language-toggle" />;
  };
});

jest.mock("@/components/ThemeToggle", () => {
  return function MockThemeToggle() {
    return <div data-testid="theme-toggle" />;
  };
});

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Signup is admin-mediated: the public /signup page is a "contact admin"
// landing page, not a credential form. These tests cover that real behaviour.
describe("SignupPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the private-system heading", () => {
    render(<SignupPage />);
    expect(screen.getByText("auth.privateSystem")).toBeInTheDocument();
  });

  it("renders the contact-admin description", () => {
    render(<SignupPage />);
    expect(screen.getByText("auth.contactAdminDesc")).toBeInTheDocument();
  });

  it("renders language and theme toggles", () => {
    render(<SignupPage />);
    expect(screen.getByTestId("language-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders a back-to-login button", () => {
    render(<SignupPage />);
    expect(
      screen.getByRole("button", { name: /backToLogin/ })
    ).toBeInTheDocument();
  });

  it("navigates to /login when the back-to-login button is clicked", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.click(screen.getByRole("button", { name: /backToLogin/ }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
