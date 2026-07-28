(() => {
    "use strict";

    const config =
        window.NQZ_SUPABASE_CONFIG;

    const sdk =
        window.supabase;

    const isPlaceholder =
        !config ||
        !config.projectUrl ||
        !config.publishableKey ||
        config.publishableKey.includes(
            "PASTE_YOUR_"
        );

    const cacheKey =
        config?.profileCacheKey ||
        "nqz-account-profile-cache-v8";

    let client = null;
    let currentAccount = null;
    let widgetInstalled = false;

    function safeJsonParse(value) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    function getCachedAccount() {
        return safeJsonParse(
            localStorage.getItem(
                cacheKey
            )
        );
    }

    function setCachedAccount(account) {
        if (!account) {
            localStorage.removeItem(
                cacheKey
            );
            return;
        }

        localStorage.setItem(
            cacheKey,
            JSON.stringify({
                ...account,
                cached_at:
                    new Date()
                        .toISOString(),
            })
        );
    }

    function initials(value) {
        const parts =
            String(value || "NQZ")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        return parts
            .slice(0, 2)
            .map(part =>
                part[0]?.toUpperCase() ||
                ""
            )
            .join("") || "NQ";
    }

    function configReady() {
        return Boolean(
            !isPlaceholder &&
            sdk?.createClient
        );
    }

    function getClient() {
        if (!configReady()) {
            return null;
        }

        if (!client) {
            client =
                sdk.createClient(
                    config.projectUrl,
                    config.publishableKey,
                    {
                        auth: {
                            persistSession:
                                true,
                            autoRefreshToken:
                                true,
                            detectSessionInUrl:
                                true,
                            storageKey:
                                config
                                    .authStorageKey,
                        },
                    }
                );
        }

        return client;
    }

    function internalEmail(
        username
    ) {
        const normalized =
            String(username || "")
                .trim()
                .toLowerCase();

        return (
            normalized +
            "@" +
            config.internalEmailDomain
        );
    }

    async function fetchAccount(
        userId
    ) {
        const sb =
            getClient();

        if (!sb || !userId) {
            return null;
        }

        const [
            profileResult,
            ratingResult,
            badgesResult,
        ] =
            await Promise.all([
                sb
                    .from("profiles")
                    .select(
                        "id,username,display_name,avatar_url,role,account_status,last_seen,created_at"
                    )
                    .eq("id", userId)
                    .single(),

                sb
                    .from("ratings")
                    .select(
                        "user_id,bot_rating,peak_bot_rating,games_played,wins,draws,losses,updated_at"
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .single(),

                sb
                    .from("user_badges")
                    .select(
                        "granted_at,expires_at,badges(code,display_name,color,icon)"
                    )
                    .eq(
                        "user_id",
                        userId
                    )
                    .order(
                        "granted_at",
                        {
                            ascending:
                                false,
                        }
                    ),
            ]);

        if (profileResult.error) {
            throw profileResult.error;
        }

        if (ratingResult.error) {
            throw ratingResult.error;
        }

        const badges =
            badgesResult.error
                ? []
                : (
                    badgesResult.data ||
                    []
                );

        const account = {
            ...profileResult.data,
            rating:
                ratingResult.data,
            badges,
        };

        currentAccount =
            account;

        setCachedAccount(
            account
        );

        return account;
    }

    async function refreshAccount() {
        const sb =
            getClient();

        if (!sb) {
            return null;
        }

        const {
            data,
            error,
        } =
            await sb.auth
                .getSession();

        if (error) {
            throw error;
        }

        const session =
            data.session;

        if (!session?.user) {
            currentAccount = null;
            setCachedAccount(null);
            renderWidget(null);
            return null;
        }

        const account =
            await fetchAccount(
                session.user.id
            );

        renderWidget(account);

        sb
            .from("profiles")
            .update({
                last_seen:
                    new Date()
                        .toISOString(),
            })
            .eq(
                "id",
                session.user.id
            )
            .then(() => {});

        return account;
    }

    async function signIn(
        username,
        password
    ) {
        const sb =
            getClient();

        if (!sb) {
            throw new Error(
                "Supabase chưa được cấu hình."
            );
        }

        const {
            data,
            error,
        } =
            await sb.auth
                .signInWithPassword({
                    email:
                        internalEmail(
                            username
                        ),
                    password:
                        String(password),
                });

        if (error) {
            throw error;
        }

        const account =
            await fetchAccount(
                data.user.id
            );

        renderWidget(account);

        return {
            session:
                data.session,
            user:
                data.user,
            account,
        };
    }

    async function register({
        username,
        displayName,
        password,
    }) {
        const sb =
            getClient();

        if (!sb) {
            throw new Error(
                "Supabase chưa được cấu hình."
            );
        }

        const {
            data,
            error,
        } =
            await sb.functions
                .invoke(
                    config
                        .registerFunction,
                    {
                        body: {
                            username:
                                String(
                                    username
                                )
                                    .trim()
                                    .toLowerCase(),

                            display_name:
                                String(
                                    displayName
                                ).trim(),

                            password:
                                String(
                                    password
                                ),
                        },
                    }
                );

        if (error) {
            let message =
                error.message ||
                "Không thể tạo tài khoản.";

            try {
                const body =
                    await error
                        .context
                        ?.json();

                if (body?.error) {
                    message =
                        body.error;
                }
            } catch {
                // Keep the generic message.
            }

            const wrapped =
                new Error(message);

            wrapped.cause =
                error;

            throw wrapped;
        }

        if (!data?.ok) {
            throw new Error(
                data?.error ||
                "Không thể tạo tài khoản."
            );
        }

        return data;
    }

    async function signOut() {
        const sb =
            getClient();

        if (sb) {
            await sb.auth
                .signOut();
        }

        currentAccount = null;
        setCachedAccount(null);
        renderWidget(null);
    }

    function installWidget() {
        if (
            widgetInstalled ||
            !document.body
        ) {
            return;
        }

        const host =
            document.querySelector(
                ".arena-actions"
            );

        if (!host) return;

        widgetInstalled = true;

        const widget =
            document.createElement(
                "div"
            );

        widget.id =
            "nqzAccountWidget";

        widget.className =
            "nqz-account-widget";

        widget.innerHTML = `
            <button
                id="nqzAccountButton"
                class="nqz-account-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded="false"
            >
                <span
                    id="nqzAccountAvatar"
                    class="nqz-account-avatar"
                >NQ</span>

                <span
                    id="nqzAccountLabel"
                    class="nqz-account-label"
                >Đăng nhập</span>

                <span
                    id="nqzAccountRating"
                    class="nqz-account-rating"
                ></span>
            </button>

            <div
                id="nqzAccountMenu"
                class="nqz-account-menu"
                role="menu"
                hidden
            ></div>
        `;

        host.prepend(widget);

        const button =
            document.getElementById(
                "nqzAccountButton"
            );

        const menu =
            document.getElementById(
                "nqzAccountMenu"
            );

        button.addEventListener(
            "click",
            () => {
                if (!currentAccount) {
                    location.href =
                        "./login.html?return=index.html";
                    return;
                }

                const open =
                    menu.hidden;

                menu.hidden =
                    !open;

                button.setAttribute(
                    "aria-expanded",
                    String(open)
                );
            }
        );

        document.addEventListener(
            "click",
            event => {
                if (
                    menu.hidden ||
                    widget.contains(
                        event.target
                    )
                ) {
                    return;
                }

                menu.hidden = true;
                button.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    menu.hidden = true;
                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            }
        );

        menu.addEventListener(
            "click",
            async event => {
                const logout =
                    event.target.closest(
                        "[data-nqz-account-logout]"
                    );

                if (!logout) return;

                logout.disabled = true;

                try {
                    await signOut();
                    location.reload();
                } finally {
                    logout.disabled =
                        false;
                }
            }
        );
    }

    function renderWidget(
        account
    ) {
        installWidget();

        const button =
            document.getElementById(
                "nqzAccountButton"
            );

        const avatar =
            document.getElementById(
                "nqzAccountAvatar"
            );

        const label =
            document.getElementById(
                "nqzAccountLabel"
            );

        const rating =
            document.getElementById(
                "nqzAccountRating"
            );

        const menu =
            document.getElementById(
                "nqzAccountMenu"
            );

        if (
            !button ||
            !avatar ||
            !label ||
            !rating ||
            !menu
        ) {
            return;
        }

        if (!account) {
            avatar.textContent =
                "NQ";

            label.textContent =
                "Đăng nhập";

            rating.textContent =
                "";

            menu.hidden = true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );

            return;
        }

        const displayName =
            account.display_name ||
            account.username;

        avatar.textContent =
            initials(displayName);

        label.textContent =
            displayName;

        rating.textContent =
            account.rating
                ? String(
                    account.rating
                        .bot_rating
                )
                : "";

        const featuredBadge =
            account.badges?.[0]
                ?.badges ||
            null;

        menu.innerHTML = `
            <div class="nqz-account-menu-name">
                ${
                    featuredBadge
                        ? `<span style="color:${
                            featuredBadge.color ||
                            "#22d3ee"
                        }">[${
                            featuredBadge.display_name
                        }]</span> `
                        : ""
                }${escapeHtml(displayName)}
            </div>

            <div class="nqz-account-menu-user">
                @${escapeHtml(
                    account.username
                )}
            </div>

            <div class="nqz-account-menu-stat">
                <span>NQZ Bot Rating</span>
                <strong>${
                    account.rating
                        ?.bot_rating ??
                    1200
                }</strong>
            </div>

            <div class="nqz-account-menu-actions">
                <a
                    class="primary"
                    href="./profile.html"
                    role="menuitem"
                >
                    Hồ sơ
                </a>

                <button
                    type="button"
                    data-nqz-account-logout
                    role="menuitem"
                >
                    Đăng xuất
                </button>
            </div>
        `;
    }

    function escapeHtml(value) {
        const element =
            document.createElement(
                "span"
            );

        element.textContent =
            String(value ?? "");

        return element.innerHTML;
    }

    function showConfigWarning() {
        if (
            location.pathname
                .endsWith(
                    "login.html"
                ) ||
            location.pathname
                .endsWith(
                    "profile.html"
                )
        ) {
            return;
        }

        const warning =
            document.createElement(
                "div"
            );

        warning.className =
            "nqz-account-config-warning";

        warning.textContent =
            "V8.0 chưa có Publishable key. Mở supabase-config.js và dán toàn bộ khóa sb_publishable_ vào đúng ô.";

        document.body.appendChild(
            warning
        );
    }

    function boot() {
        installWidget();

        const cached =
            getCachedAccount();

        if (cached) {
            currentAccount =
                cached;

            renderWidget(
                cached
            );
        } else {
            renderWidget(null);
        }

        if (!configReady()) {
            showConfigWarning();
            return;
        }

        const sb =
            getClient();

        sb.auth.onAuthStateChange(
            event => {
                if (
                    event ===
                    "SIGNED_OUT"
                ) {
                    currentAccount =
                        null;

                    setCachedAccount(
                        null
                    );

                    renderWidget(null);
                }

                if (
                    event ===
                        "SIGNED_IN" ||
                    event ===
                        "TOKEN_REFRESHED" ||
                    event ===
                        "USER_UPDATED"
                ) {
                    window.setTimeout(
                        () => {
                            refreshAccount()
                                .catch(
                                    console.error
                                );
                        },
                        0
                    );
                }
            }
        );

        refreshAccount()
            .catch(error => {
                console.error(
                    "NQZ account refresh failed:",
                    error
                );
            });
    }

    window.NQZ_ACCOUNT = {
        configReady,
        getClient,
        getCachedAccount,
        getCurrentAccount:
            () =>
                currentAccount,
        internalEmail,
        register,
        signIn,
        signOut,
        fetchAccount,
        refreshAccount,
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true,
            }
        );
    } else {
        boot();
    }
})();
