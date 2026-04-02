import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

const mockPush = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
}));

jest.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "ar" }),
}));

jest.mock("@/components/LanguageToggle", () => {
  return function MockLanguageToggle() {
    return <div data-testid="language-toggle" />;
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders login form with phone and password inputs", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("01XXXXXXXXX")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "auth.loginButton" })).toBeInTheDocument();
  });

  it("shows error when phone is empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    expect(screen.getByText("auth.phoneRequired")).toBeInTheDocument();
  });

  it("shows error when password is empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    expect(screen.getByText("auth.passwordRequired")).toBeInTheDocument();
  });

  it("calls signInWithPassword with correct email format", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "01234567890@church.local",
        password: "secret123",
      });
    });
  });

  it("redirects to /trips on successful login", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/trips");
    });
  });

  it("shows invalid credentials error on auth failure", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    await waitFor(() => {
      expect(screen.getByText("auth.invalidCredentials")).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();
    let resolveAuth: (value: unknown) => void;
    mockSignInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.loginButton" }));
    expect(screen.getByRole("button")).toBeDisabled();
    resolveAuth!({ error: null });
    await waitFor(() => {
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  it("prevents double submission", async () => {
    const user = userEvent.setup();
    let resolveAuth: (value: unknown) => void;
    mockSignInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    const submitButton = screen.getByRole("button", { name: "auth.loginButton" });
    await user.click(submitButton);
    expect(submitButton).toBeDisabled();
    resolveAuth!({ error: null });
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    });
  });
});
