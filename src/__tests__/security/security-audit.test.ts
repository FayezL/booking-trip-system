import fs from "fs";
import path from "path";

// After the schema refactor, the RLS policies, RPC functions, and bookings
// constraint all live in the initial migration. (Previously these were spread
// across 00005/00007/00008 which no longer exist.)
const schemaSql = fs.readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/00001_initial_schema.sql"),
  "utf-8"
);

const constantsSrc = fs.readFileSync(
  path.resolve(__dirname, "../../lib/constants.ts"),
  "utf-8"
);

const middlewareSrc = fs.readFileSync(
  path.resolve(__dirname, "../../lib/supabase/middleware.ts"),
  "utf-8"
);

const layoutSrc = fs.readFileSync(
  path.resolve(__dirname, "../../app/(authenticated)/layout.tsx"),
  "utf-8"
);

const loginSrc = fs.readFileSync(
  path.resolve(__dirname, "../../app/login/page.tsx"),
  "utf-8"
);

const signupSrc = fs.readFileSync(
  path.resolve(__dirname, "../../app/signup/page.tsx"),
  "utf-8"
);

const serverClientSrc = fs.readFileSync(
  path.resolve(__dirname, "../../lib/supabase/server.ts"),
  "utf-8"
);

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

const allSrcFiles = getAllSourceFiles(
  path.resolve(__dirname, "../..")
).filter((f) => !f.includes("__tests__"));

function fnBody(name: string) {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\$\\$;`
  );
  return schemaSql.match(re)?.[0] ?? "";
}

describe("SQL / Migration Security", () => {
  describe("Row Level Security", () => {
    it("enables RLS on profiles table", () => {
      expect(schemaSql).toContain(
        "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on trips table", () => {
      expect(schemaSql).toContain(
        "ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on buses table", () => {
      expect(schemaSql).toContain(
        "ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on rooms table", () => {
      expect(schemaSql).toContain(
        "ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on bookings table", () => {
      expect(schemaSql).toContain(
        "ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY"
      );
    });
  });

  describe("Bookings INSERT policy", () => {
    const insertPolicy = schemaSql.match(
      /CREATE POLICY "Users can create own bookings"[\s\S]*?;/i
    )?.[0];

    it("checks trip is_open = true", () => {
      expect(insertPolicy).toBeTruthy();
      expect(insertPolicy).toMatch(/is_open\s*=\s*true/);
    });

    it("scopes inserts to the authenticated user (auth.uid() = user_id)", () => {
      expect(insertPolicy).toBeTruthy();
      expect(insertPolicy).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    });
  });

  describe("Servant / role access control", () => {
    // After the refactor, servants no longer get direct table CRUD through RLS
    // policies; access is mediated by SECURITY DEFINER RPC functions that
    // validate the caller's role against an allowlist.
    it("profiles role CHECK constraint recognises the servant role", () => {
      expect(schemaSql).toMatch(
        /CHECK\s*\(\s*role IN \([^)]*'servant'[^)]*\)/i
      );
    });

    it("register_and_book validates role against an allowlist including servant", () => {
      expect(fnBody("register_and_book")).toMatch(
        /p_role NOT IN \([^)]*'servant'[^)]*\)/i
      );
    });
  });

  describe("register_and_book RPC security", () => {
    it("uses SECURITY DEFINER", () => {
      expect(fnBody("register_and_book")).toContain("SECURITY DEFINER");
    });

    it("is gated to admin callers", () => {
      expect(fnBody("register_and_book")).toMatch(/IF NOT public\.is_admin\(\)/);
    });

    it("hashes password with bcrypt via crypt() + gen_salt('bf')", () => {
      expect(fnBody("register_and_book")).toMatch(
        /crypt\([^,]+,\s*gen_salt\('bf'\)\)/
      );
    });

    it("uses {phone}@church.local email format", () => {
      expect(fnBody("register_and_book")).toMatch(
        /p_phone\s*\|\|\s*'@church\.local/
      );
    });

    it("stores full_name in user metadata", () => {
      expect(fnBody("register_and_book")).toMatch(/'full_name'/);
    });

    it("stores gender in user metadata", () => {
      expect(fnBody("register_and_book")).toMatch(/'gender'/);
    });

    it("locks the bus row with FOR UPDATE before capacity check", () => {
      expect(fnBody("register_and_book")).toMatch(
        /FROM public\.buses WHERE id = p_bus_id FOR UPDATE/i
      );
    });

    it("rejects booking when the trip is not open", () => {
      expect(fnBody("register_and_book")).toMatch(/is_open\s*=\s*true/);
    });

    it("prevents double-booking a trip", () => {
      expect(fnBody("register_and_book")).toMatch(/Already booked this trip/);
    });
  });

  describe("assign_room RPC security", () => {
    it("uses SECURITY DEFINER", () => {
      expect(fnBody("assign_room")).toContain("SECURITY DEFINER");
    });

    it("is gated to admin callers", () => {
      expect(fnBody("assign_room")).toMatch(/IF NOT public\.is_admin\(\)/);
    });

    it("validates gender match between booking and room", () => {
      expect(fnBody("assign_room")).toMatch(/v_gender\s*!=\s*v_room_type/);
    });

    it("locks the room row with FOR UPDATE", () => {
      expect(fnBody("assign_room")).toMatch(
        /FROM public\.rooms WHERE id = p_room_id FOR UPDATE/i
      );
    });
  });

  describe("cancel_booking RPC security", () => {
    it("uses SECURITY DEFINER", () => {
      expect(fnBody("cancel_booking")).toContain("SECURITY DEFINER");
    });

    it("soft-deletes by setting cancelled_at = now()", () => {
      expect(fnBody("cancel_booking")).toMatch(
        /SET\s+cancelled_at\s*=\s*now\(\)/
      );
    });

    it("clears room assignment on cancel (room_id = NULL)", () => {
      expect(fnBody("cancel_booking")).toMatch(/room_id\s*=\s*NULL/);
    });
  });

  describe("Bookings unique constraint", () => {
    it("uses partial index WHERE cancelled_at IS NULL", () => {
      expect(schemaSql).toMatch(
        /CREATE UNIQUE INDEX idx_bookings_unique_active ON public\.bookings\s*\(user_id,\s*trip_id\)\s*WHERE cancelled_at IS NULL/i
      );
    });
  });
});

describe("Auth Security", () => {
  describe("Middleware redirect logic", () => {
    it("redirects unauthenticated users away from protected routes", () => {
      expect(middlewareSrc).toMatch(/!user/);
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/login["']\)/);
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/signup["']\)/);
      expect(middlewareSrc).toMatch(/NextResponse\.redirect/);
    });

    it("redirects authenticated users away from /login and /signup", () => {
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/login["']\)/);
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/signup["']\)/);
      expect(middlewareSrc).toMatch(/NextResponse\.redirect/);
    });

    it("checks admin role before allowing /admin access", () => {
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/admin["']\)/);
      expect(middlewareSrc).toMatch(/profile\.role\s*!==?\s*["']admin["']/);
    });
  });

  describe("Authenticated layout", () => {
    it("does server-side session check via supabase.auth.getUser()", () => {
      expect(layoutSrc).toContain("supabase.auth.getUser()");
    });

    it("redirects to /login if no user is found", () => {
      expect(layoutSrc).toMatch(/if\s*\(\s*!user\s*\)/);
      expect(layoutSrc).toContain('redirect("/login")');
    });

    it("redirects to /login if no profile is found", () => {
      expect(layoutSrc).toMatch(/!profile/);
      expect(layoutSrc).toContain('redirect("/login")');
    });
  });

  describe("Login security", () => {
    it("constructs email as {phone}@church.local", () => {
      expect(loginSrc).toMatch(/`\$\{phone\}@church\.local`/);
    });

    it("uses signInWithPassword with the constructed email", () => {
      expect(loginSrc).toContain("signInWithPassword");
    });

    it("validates phone against a digit regex constant", () => {
      expect(constantsSrc).toMatch(/PHONE_REGEX\s*=\s*\/\^\\d\{11\}\$\//);
      expect(loginSrc).toMatch(/PHONE_REGEX\.test\(phone\)/);
    });

    it("enforces a minimum password length", () => {
      expect(constantsSrc).toMatch(/PASSWORD_MIN_LENGTH\s*=\s*6/);
      expect(loginSrc).toMatch(/password\.length\s*<\s*PASSWORD_MIN_LENGTH/);
    });

    it("phone input has type=\"tel\"", () => {
      expect(loginSrc).toMatch(/type="tel"/);
    });

    it("password input has type=\"password\"", () => {
      expect(loginSrc).toMatch(/type="password"/);
    });

    it("login inputs are disabled while loading", () => {
      expect(loginSrc).toMatch(/disabled=\{loading\}/);
    });

    it("login submit button is disabled while loading", () => {
      expect(loginSrc).toMatch(
        /<Button[\s\S]*?type="submit"[\s\S]*?disabled=\{loading\}/
      );
    });
  });

  describe("Signup flow (admin-mediated)", () => {
    // Self-service signup was removed; accounts are created by admins through
    // the register_and_book / admin_create_user SECURITY DEFINER RPCs. The
    // public /signup page must therefore NOT collect credentials client-side.
    it("does not render a password input on the public signup page", () => {
      expect(signupSrc).not.toMatch(/type="password"/);
    });

    it("does not call auth.signUp from the client", () => {
      expect(signupSrc).not.toMatch(/\.signUp\b/);
    });

    it("provides a back-to-login navigation affordance", () => {
      expect(signupSrc).toMatch(/\/login/);
    });
  });
});

describe("XSS Prevention", () => {
  it("no source file uses dangerouslySetInnerHTML", () => {
    for (const file of allSrcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect({
        file,
        hasDangerous: content.includes("dangerouslySetInnerHTML"),
      }).toEqual(expect.objectContaining({ hasDangerous: false }));
    }
  });

  it("dynamic content in login is rendered via JSX (auto-escaped)", () => {
    expect(loginSrc).toMatch(/\{error\}/);
    expect(loginSrc).toMatch(/\{t\(["']/);
    expect(loginSrc).not.toContain("dangerouslySetInnerHTML");
  });

  it("dynamic content in signup is rendered via JSX (auto-escaped)", () => {
    expect(signupSrc).toMatch(/\{t\(["']/);
    expect(signupSrc).not.toContain("dangerouslySetInnerHTML");
  });

  it("no source file uses direct DOM manipulation with user input", () => {
    for (const file of allSrcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toMatch(/innerHTML\s*=/);
      expect(content).not.toMatch(/outerHTML\s*=/);
    }
  });
});

describe("CSRF Protection", () => {
  it("Supabase SSR server client uses cookie-based auth", () => {
    expect(serverClientSrc).toContain("createServerClient");
    expect(serverClientSrc).toContain("cookies");
    expect(serverClientSrc).toContain("getAll");
    expect(serverClientSrc).toContain("setAll");
  });

  it("middleware uses cookie-based auth via getAll/setAll pattern", () => {
    expect(middlewareSrc).toContain("createServerClient");
    expect(middlewareSrc).toContain("cookies");
    expect(middlewareSrc).toMatch(/getAll\(\)/);
    expect(middlewareSrc).toMatch(/setAll/);
  });

  it("server client sets cookies via next/headers (HttpOnly cookies)", () => {
    expect(serverClientSrc).toContain("next/headers");
    expect(serverClientSrc).toMatch(/cookieStore\.set\(/);
  });
});
