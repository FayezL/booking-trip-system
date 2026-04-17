import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

import SignupPage from "@/app/signup/page";

const mockPush = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword, signUp: mockSignUp },
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

jest.mock("@/components/ThemeToggle", () => {
  return function MockThemeToggle() {
    return <div data-testid="theme-toggle" />;
  };
});

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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
    const submitButton = screen.getByRole("button", { name: "auth.loginButton" });
    await user.click(submitButton);
    expect(submitButton).toBeDisabled();
    resolveAuth!({ error: null });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "auth.loginButton" })).not.toBeDisabled();
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

describe("SignupPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders signup form with phone, name, gender, password fields", () => {
    render(<SignupPage />);
    expect(screen.getByPlaceholderText("01XXXXXXXXX")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByText("auth.male")).toBeInTheDocument();
    expect(screen.getByText("auth.female")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "auth.signupButton" })).toBeInTheDocument();
  });

  it("shows error when phone is empty", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    expect(screen.getByText("auth.phoneRequired")).toBeInTheDocument();
  });

  it("shows error when name is empty", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    expect(screen.getByText("auth.nameRequired")).toBeInTheDocument();
  });

  it("shows error when gender is not selected", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    expect(screen.getByText("auth.genderRequired")).toBeInTheDocument();
  });

  it("shows error when password is empty", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByText("auth.male"));
    await user.click(screen.getByText("admin.patient"));
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    expect(screen.getByText("auth.passwordRequired")).toBeInTheDocument();
  });

  it("calls signUp with correct email format and metadata", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({ error: null });
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByText("auth.male"));
    await user.click(screen.getByText("admin.patient"));
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "01234567890@church.local",
        password: "secret123",
        options: {
          data: {
            full_name: "John Doe",
            gender: "Male",
            role: "patient",
            has_wheelchair: false,
          },
        },
      });
    });
  });

  it("redirects to /trips on successful signup", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({ error: null });
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByText("auth.male"));
    await user.click(screen.getByText("admin.patient"));
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/trips");
    });
  });

  it("shows phone exists error when phone already registered", async () => {
    const user = userEvent.setup();
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered" },
    });
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByText("auth.male"));
    await user.click(screen.getByText("admin.patient"));
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    await waitFor(() => {
      expect(screen.getByText("auth.phoneExists")).toBeInTheDocument();
    });
  });

  it("disables all inputs during loading", async () => {
    const user = userEvent.setup();
    let resolveAuth: (value: unknown) => void;
    mockSignUp.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );
    render(<SignupPage />);
    await user.type(screen.getByPlaceholderText("01XXXXXXXXX"), "01234567890");
    const nameInput = screen.getAllByRole("textbox").find(
      (el: HTMLElement) => el.getAttribute("type") === "text"
    );
    await user.type(nameInput!, "John Doe");
    await user.click(screen.getByText("auth.male"));
    await user.click(screen.getByText("admin.patient"));
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "auth.signupButton" }));
    expect(screen.getByPlaceholderText("01XXXXXXXXX")).toBeDisabled();
    expect(nameInput).toBeDisabled();
    expect(screen.getByPlaceholderText("••••••••")).toBeDisabled();
    expect(screen.getByText("auth.male")).toBeDisabled();
    expect(screen.getByText("auth.female")).toBeDisabled();
    resolveAuth!({ error: null });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("01XXXXXXXXX")).not.toBeDisabled();
    });
  });

  it("selects Male when Male button is clicked", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    const maleButton = screen.getByText("auth.male");
    await user.click(maleButton);
    expect(maleButton.className).toContain("border-blue-500");
  });

  it("selects Female when Female button is clicked", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    const femaleButton = screen.getByText("auth.female");
    await user.click(femaleButton);
    expect(femaleButton.className).toContain("border-blue-500");
  });

  it("switches gender selection from Male to Female", async () => {
    const user = userEvent.setup();
    render(<SignupPage />);
    const maleButton = screen.getByText("auth.male");
    const femaleButton = screen.getByText("auth.female");
    await user.click(maleButton);
    expect(maleButton.className).toContain("border-blue-500");
    await user.click(femaleButton);
    expect(femaleButton.className).toContain("border-blue-500");
    expect(maleButton.className).not.toContain("border-blue-500");
  });
});
