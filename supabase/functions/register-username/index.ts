import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  withSupabase,
} from "jsr:@supabase/server@^1";

import {
  createClient,
} from "npm:@supabase/supabase-js@2";

interface RegisterPayload {
  username?: unknown;
  display_name?: unknown;
  password?: unknown;
}

const USERNAME_PATTERN =
  /^[a-z0-9_]{3,20}$/;

const RESERVED_NAMES =
  new Set([
    "admin",
    "administrator",
    "owner",
    "moderator",
    "developer",
    "support",
    "system",
    "supabase",
    "nqznzee",
  ]);

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

function createAdminClient() {
  const url =
    Deno.env.get("SUPABASE_URL");

  const secretKeysRaw =
    Deno.env.get(
      "SUPABASE_SECRET_KEYS",
    );

  if (!url || !secretKeysRaw) {
    throw new Error(
      "Thiếu biến môi trường Supabase.",
    );
  }

  const secretKeys =
    JSON.parse(secretKeysRaw);

  const secretKey =
    secretKeys.default;

  if (!secretKey) {
    throw new Error(
      "Không tìm thấy secret key mặc định.",
    );
  }

  return createClient(
    url,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export default {
  fetch: withSupabase(
    {
      auth: "publishable",
    },

    async (req) => {
      if (req.method !== "POST") {
        return json(
          {
            ok: false,
            error:
              "Chỉ hỗ trợ phương thức POST.",
          },
          405,
        );
      }

      let payload:
        RegisterPayload;

      try {
        payload =
          await req.json();
      } catch {
        return json(
          {
            ok: false,
            error:
              "Dữ liệu gửi lên không hợp lệ.",
          },
          400,
        );
      }

      const username =
        String(
          payload.username ?? "",
        )
          .trim()
          .toLowerCase();

      const displayName =
        String(
          payload.display_name ??
            username,
        ).trim();

      const password =
        String(
          payload.password ?? "",
        );

      if (
        !USERNAME_PATTERN.test(
          username,
        )
      ) {
        return json(
          {
            ok: false,
            error:
              "Tên đăng nhập phải có 3–20 ký tự, chỉ gồm chữ thường, số hoặc dấu gạch dưới.",
          },
          400,
        );
      }

      if (
        RESERVED_NAMES.has(username)
      ) {
        return json(
          {
            ok: false,
            error:
              "Tên đăng nhập này được dành riêng cho hệ thống.",
          },
          409,
        );
      }

      if (
        displayName.length < 1 ||
        displayName.length > 30
      ) {
        return json(
          {
            ok: false,
            error:
              "Tên hiển thị phải có từ 1 đến 30 ký tự.",
          },
          400,
        );
      }

      if (
        password.length < 8 ||
        password.length > 72 ||
        !/[A-Za-z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        return json(
          {
            ok: false,
            error:
              "Mật khẩu phải dài 8–72 ký tự và có cả chữ lẫn số.",
          },
          400,
        );
      }

      let admin;

      try {
        admin =
          createAdminClient();
      } catch (error) {
        console.error(
          "Admin client error:",
          error,
        );

        return json(
          {
            ok: false,
            error:
              "Function chưa được cấu hình quyền máy chủ.",
          },
          500,
        );
      }

      const {
        data: existingProfile,
        error: lookupError,
      } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (lookupError) {
        console.error(
          "Username lookup failed:",
          lookupError,
        );

        return json(
          {
            ok: false,
            error:
              "Không thể kiểm tra tên đăng nhập.",
          },
          500,
        );
      }

      if (existingProfile) {
        return json(
          {
            ok: false,
            error:
              "Tên đăng nhập đã được sử dụng.",
          },
          409,
        );
      }

      const internalEmail =
        `${username}` +
        "@users.nqznzee.invalid";

      const {
        data,
        error,
      } =
        await admin.auth.admin
          .createUser({
            email: internalEmail,
            password,
            email_confirm: true,

            user_metadata: {
              username,

              display_name:
                displayName,

              account_type:
                "username",
            },
          });

      if (error || !data.user) {
        console.error(
          "Account creation failed:",
          error,
        );

        const errorMessage =
          error?.message
            ?.toLowerCase() ?? "";

        if (
          errorMessage.includes(
            "already",
          ) ||
          errorMessage.includes(
            "duplicate",
          )
        ) {
          return json(
            {
              ok: false,
              error:
                "Tên đăng nhập đã được sử dụng.",
            },
            409,
          );
        }

        return json(
          {
            ok: false,
            error:
              "Không thể tạo tài khoản lúc này.",
          },
          500,
        );
      }

      return json(
        {
          ok: true,

          account: {
            id: data.user.id,
            username,

            display_name:
              displayName,
          },
        },
        201,
      );
    },
  ),
};
