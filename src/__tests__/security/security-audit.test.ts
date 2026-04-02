import fs from "fs";
import path from "path";

const rlsSql = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../supabase/migrations/00007_enable_rls.sql"
  ),
  "utf-8"
);

const rpcSql = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../supabase/migrations/00008_create_rpc_functions.sql"
  ),
  "utf-8"
);

const bookingsSql = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../supabase/migrations/00005_create_bookings.sql"
  ),
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

function getAllSourceFiles(dir: string, ext = ".tsx"): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(full, ext));
    } else if (
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".ts")
    ) {
      results.push(full);
    }
  }
  return results;
}

const allSrcFiles = getAllSourceFiles(
  path.resolve(__dirname, "../..")
).filter((f) => !f.includes("__tests__"));

describe("SQL / Migration Security", () => {
  describe("Row Level Security", () => {
    it("enables RLS on profiles table", () => {
      expect(rlsSql).toContain(
        "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on trips table", () => {
      expect(rlsSql).toContain(
        "ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on buses table", () => {
      expect(rlsSql).toContain(
        "ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on rooms table", () => {
      expect(rlsSql).toContain(
        "ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY"
      );
    });

    it("enables RLS on bookings table", () => {
      expect(rlsSql).toContain(
        "ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY"
      );
    });
  });

  describe("Bookings INSERT policy", () => {
    const insertPolicy = rlsSql.match(
      /CREATE POLICY "Users can create own bookings"[\s\S]*?;/i
    )?.[0];

    it("checks trip is_open = true", () => {
      expect(insertPolicy).toBeTruthy();
      expect(insertPolicy).toMatch(/is_open\s*=\s*true/);
    });

    it("checks auth.uid() = user_id so patients can only book for themselves", () => {
      expect(insertPolicy).toBeTruthy();
      expect(insertPolicy).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    });
  });

  describe("Servant role policies", () => {
    const servantPolicies = rlsSql.match(
      /CREATE POLICY "Servants[\s\S]*?;/gi
    );

    it("all servant policies use EXISTS subquery to verify role", () => {
      expect(servantPolicies).toBeTruthy();
      expect(servantPolicies!.length).toBeGreaterThanOrEqual(4);
      for (const policy of servantPolicies!) {
        expect(policy).toMatch(
          /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.profiles\s+WHERE\s+id\s*=\s*auth\.uid\(\)\s+AND\s+role\s*=\s*'servant'/i
        );
      }
    });
  });

  describe("RPC function security", () => {
    it("register_and_book uses SECURITY DEFINER", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.register_and_book[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toContain("SECURITY DEFINER");
    });

    it("register_and_book uses crypt() with bcrypt for password hashing", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.register_and_book[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/crypt\([^,]+,\s*gen_salt\('bf'\)\)/);
    });

    it("register_and_book uses FOR UPDATE row-level locking on buses", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.register_and_book[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/FROM\s+public\.buses\s+WHERE\s+id\s*=\s*p_bus_id\s+FOR\s+UPDATE/i);
    });

    it("assign_room uses SECURITY DEFINER", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.assign_room[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toContain("SECURITY DEFINER");
    });

    it("assign_room validates gender match", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.assign_room[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/v_gender\s*!=\s*v_room_type/);
    });

    it("assign_room uses row-level locking on rooms with FOR UPDATE", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.assign_room[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/FROM\s+public\.rooms\s+WHERE\s+id\s*=\s*p_room_id\s+FOR\s+UPDATE/i);
    });

    it("cancel_booking uses SECURITY DEFINER", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.cancel_booking[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toContain("SECURITY DEFINER");
    });

    it("cancel_booking sets cancelled_at for soft delete", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.cancel_booking[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/SET\s+cancelled_at\s*=\s*now\(\)/);
    });

    it("cancel_booking clears room_id", () => {
      const fn = rpcSql.match(
        /CREATE OR REPLACE FUNCTION public\.cancel_booking[\s\S]*?\$\$;/
      )?.[0];
      expect(fn).toBeTruthy();
      expect(fn).toMatch(/room_id\s*=\s*NULL/);
    });
  });

  describe("Bookings unique constraint", () => {
    it("uses partial index WHERE cancelled_at IS NULL", () => {
      expect(bookingsSql).toMatch(
        /CONSTRAINT\s+unique_active_booking\s+UNIQUE\s*\(\s*user_id\s*,\s*trip_id\s*\)\s*WHERE\s+cancelled_at\s+IS\s+NULL/i
      );
    });
  });
});

describe("Auth Security", () => {
  describe("Middleware redirect logic", () => {
    it("redirects unauthenticated users to /login", () => {
      expect(middlewareSrc).toMatch(/!user/);
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/login["']\)/);
      expect(middlewareSrc).toMatch(/pathname\.startsWith\(["']\/signup["']\)/);
      expect(middlewareSrc).toMatch(/NextResponse\.redirect/);
    });

    it("redirects authenticated users away from /login and /signup", () => {
      expect(middlewareSrc).toMatch(
        /if\s*\(\s*user\s*&&\s*\(pathname\.startsWith\(["']\/login["']\)\s*\|\|\s*pathname\.startsWith\(["']\/signup["']\)\s*\)\s*\)/
      );
    });

    it("checks servant role before allowing /admin access", () => {
      expect(middlewareSrc).toMatch(
        /if\s*\(\s*user\s*&&\s*pathname\.startsWith\(["']\/admin["']\)\s*\)/
      );
      expect(middlewareSrc).toMatch(/profile\.role\s*!==?\s*["']servant["']/);
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
      expect(layoutSrc).toMatch(/if\s*\(\s*!profile\s*\)/);
      expect(layoutSrc).toContain('redirect("/login")');
    });
  });

  describe("Login email format", () => {
    it("uses {phone}@church.local email hack", () => {
      expect(loginSrc).toMatch(
        /`\$\{.*phone.*\}@church\.local`/
      );
    });

    it("uses signInWithPassword with the constructed email", () => {
      expect(loginSrc).toContain("signInWithPassword");
      expect(loginSrc).toMatch(/email[,\s]/);
    });
  });

  describe("Signup metadata", () => {
    it("includes full_name in user metadata", () => {
      expect(signupSrc).toMatch(
        /data:\s*\{[^}]*full_name/
      );
    });

    it("includes gender in user metadata", () => {
      expect(signupSrc).toMatch(
        /data:\s*\{[^}]*gender/
      );
    });

    it("uses {phone}@church.local email format", () => {
      expect(signupSrc).toMatch(
        /`\$\{.*phone.*\}@church\.local`/
      );
    });
  });
});

describe("Input Validation Security", () => {
  describe("Signup validation", () => {
    it("validates phone is required and matches digit format", () => {
      expect(signupSrc).toMatch(/!phone\.trim\(\)/);
      expect(signupSrc).toMatch(/\\d\{8,15\}/);
    });

    it("validates fullName is required", () => {
      expect(signupSrc).toMatch(/if\s*\(\s*!fullName\.trim\(\)\s*\)/);
    });

    it("validates gender is required", () => {
      expect(signupSrc).toMatch(/if\s*\(\s*!gender\s*\)/);
    });

    it("validates password is required with minimum length", () => {
      expect(signupSrc).toMatch(/!password\.trim\(\)/);
      expect(signupSrc).toMatch(/password\.length\s*<\s*6/);
    });
  });

  describe("Login validation", () => {
    it("validates phone is required and matches digit format", () => {
      expect(loginSrc).toMatch(/!phone\.trim\(\)/);
      expect(loginSrc).toMatch(/\\d\{8,15\}/);
    });

    it("validates password is required with minimum length", () => {
      expect(loginSrc).toMatch(/!password\.trim\(\)/);
      expect(loginSrc).toMatch(/password\.length\s*<\s*6/);
    });
  });

  describe("Input types", () => {
    it("phone input has type=\"tel\"", () => {
      expect(loginSrc).toMatch(/type="tel"/);
      expect(signupSrc).toMatch(/type="tel"/);
    });

    it("password inputs have type=\"password\"", () => {
      expect(loginSrc).toMatch(/type="password"/);
      expect(signupSrc).toMatch(/type="password"/);
    });
  });

  describe("Loading state protection", () => {
    it("login form inputs have disabled={loading}", () => {
      const loginInputBlocks = loginSrc.match(/<input[\s\S]*?\/>/g) || [];
      for (const block of loginInputBlocks) {
        expect(block).toContain("disabled={loading}");
      }
    });

    it("signup form inputs have disabled={loading}", () => {
      const signupInputBlocks =
        signupSrc.match(/<input[\s\S]*?\/>/g) || [];
      for (const block of signupInputBlocks) {
        expect(block).toContain("disabled={loading}");
      }
    });

    it("login submit button has disabled={loading}", () => {
      expect(loginSrc).toMatch(
        /<button[\s\S]*?type="submit"[\s\S]*?disabled=\{loading\}/
      );
    });

    it("signup submit button has disabled={loading}", () => {
      expect(signupSrc).toMatch(
        /<button[\s\S]*?type="submit"[\s\S]*?disabled=\{loading\}/
      );
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
      }).toEqual(
        expect.objectContaining({ hasDangerous: false })
      );
    }
  });

  it("dynamic content in login is rendered via JSX (auto-escaped)", () => {
    expect(loginSrc).toMatch(/\{error\}/);
    expect(loginSrc).toMatch(/\{t\(["']/);
    expect(loginSrc).not.toContain("dangerouslySetInnerHTML");
  });

  it("dynamic content in signup is rendered via JSX (auto-escaped)", () => {
    expect(signupSrc).toMatch(/\{error\}/);
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
