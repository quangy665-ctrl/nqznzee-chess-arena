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

    const CHESS_TITLE_DEFINITIONS =
        Object.freeze([
            Object.freeze({
                code: "GM",
                label: "GM",
                rank: 300,
                color: "#a63d4d",
                aliases: Object.freeze([
                    "GM",
                    "NQZ_GM",
                    "GRANDMASTER",
                ]),
            }),

            Object.freeze({
                code: "IM",
                label: "IM",
                rank: 200,
                color: "#c55b3f",
                aliases: Object.freeze([
                    "IM",
                    "NQZ_IM",
                    "INTERNATIONAL_MASTER",
                ]),
            }),

            Object.freeze({
                code: "FM",
                label: "FM",
                rank: 100,
                color: "#9a6a45",
                aliases: Object.freeze([
                    "FM",
                    "NQZ_FM",
                    "FIDE_MASTER",
                ]),
            }),
        ]);

    function normalizeBadgeCode(
        value
    ) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_");
    }

    function activeBadgeEntries(
        account
    ) {
        const now =
            Date.now();

        return (
            Array.isArray(
                account?.badges
            )
                ? account.badges
                : []
        ).filter(entry => {
            if (!entry?.badges) {
                return false;
            }

            if (!entry.expires_at) {
                return true;
            }

            const expiresAt =
                new Date(
                    entry.expires_at
                ).getTime();

            return (
                Number.isFinite(
                    expiresAt
                ) &&
                expiresAt > now
            );
        });
    }

    function getChessTitle(
        account
    ) {
        const entries =
            activeBadgeEntries(
                account
            );

        for (
            const definition
            of CHESS_TITLE_DEFINITIONS
        ) {
            const match =
                entries.find(entry => {
                    const badge =
                        entry.badges;

                    const code =
                        normalizeBadgeCode(
                            badge.code
                        );

                    const displayName =
                        normalizeBadgeCode(
                            badge.display_name
                        );

                    return definition
                        .aliases
                        .some(alias => {
                            const normalized =
                                normalizeBadgeCode(
                                    alias
                                );

                            return (
                                code ===
                                    normalized ||
                                displayName ===
                                    normalized
                            );
                        });
                });

            if (match) {
                return {
                    code:
                        definition.code,

                    label:
                        definition.label,

                    rank:
                        definition.rank,

                    color:
                        match.badges
                            .color ||
                        definition.color,

                    badge:
                        match.badges,
                };
            }
        }

        return null;
    }

    function getAccountIdentity(
        account
    ) {
        const displayName =
            String(
                account
                    ?.display_name ||
                account
                    ?.username ||
                "Người chơi"
            ).trim() ||
            "Người chơi";

        const rawRating =
            Number(
                account
                    ?.rating
                    ?.bot_rating
            );

        const rating =
            Number.isFinite(
                rawRating
            )
                ? Math.round(rawRating)
                : 1200;

        const title =
            getChessTitle(
                account
            );

        const label =
            (
                title
                    ? `[${title.label}] `
                    : ""
            ) +
            displayName +
            ` (${rating})`;

        return {
            displayName,
            rating,
            title,
            label,
        };
    }

    function enrichAccount(
        account
    ) {
        if (!account) {
            return null;
        }

        registerButton.hidden = true;

        const identity =
            getAccountIdentity(
                account
            );

        return {
            ...account,

            badges:
                activeBadgeEntries(
                    account
                ),

            chess_title:
                identity.title,

            identity_label:
                identity.label,
        };
    }

    function dispatchAccountUpdate(
        account
    ) {
        window.dispatchEvent(
            new CustomEvent(
                "nqz-account-updated",
                {
                    detail: {
                        account:
                            enrichAccount(
                                account
                            ),
                    },
                }
            )
        );
    }

    function safeJsonParse(value) {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    function getCachedAccount() {
        return enrichAccount(
            safeJsonParse(
                localStorage.getItem(
                    cacheKey
                )
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

        const enriched =
            enrichAccount(
                account
            );

        localStorage.setItem(
            cacheKey,
            JSON.stringify({
                ...enriched,
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

        const account =
            enrichAccount({
                ...profileResult.data,

                rating:
                    ratingResult.data,

                badges,
            });

        currentAccount =
            account;

        setCachedAccount(
            account
        );

        dispatchAccountUpdate(
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
            dispatchAccountUpdate(null);
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
        dispatchAccountUpdate(null);
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

            <a
                id="nqzRegisterButton"
                class="nqz-account-register-button"
                href="./login.html?mode=register&return=play.html"
            >
                Đăng ký
            </a>

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

        const registerButton =
            document.getElementById(
                "nqzRegisterButton"
            );

        button.addEventListener(
            "click",
            () => {
                if (!currentAccount) {
                    location.href =
                        "./login.html?return=play.html";
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
            !menu ||
            !registerButton
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
            registerButton.hidden = false;

            button.setAttribute(
                "aria-expanded",
                "false"
            );

            return;
        }

        const identity =
            getAccountIdentity(
                account
            );

        const displayName =
            identity.displayName;

        avatar.textContent =
            initials(displayName);

        label.textContent =
            (
                identity.title
                    ? `${identity.title.label} `
                    : ""
            ) +
            displayName;

        rating.textContent =
            String(
                identity.rating
            );

        menu.innerHTML = `
            <div class="nqz-account-menu-name">
                ${
                    identity.title
                        ? `<span
                            class="nqz-account-title-badge"
                            data-title="${escapeHtml(
                                identity.title.code
                            )}"
                            style="--nqz-title-color:${
                                escapeHtml(
                                    identity.title.color
                                )
                            }"
                        >${escapeHtml(
                            identity.title.label
                        )}</span> `
                        : ""
                }${escapeHtml(displayName)}
                <span class="nqz-account-menu-inline-rating">
                    (${identity.rating})
                </span>
            </div>

            <div class="nqz-account-menu-user">
                @${escapeHtml(
                    account.username
                )}
            </div>

            <div class="nqz-account-menu-stat">
                <span>NQZ Bot Rating</span>
                <strong>${
                    identity.rating
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

            dispatchAccountUpdate(
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
                    dispatchAccountUpdate(null);
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
        getChessTitle,
        getAccountIdentity,
        formatIdentity:
            account =>
                getAccountIdentity(
                    account
                ).label,
        titleDefinitions:
            CHESS_TITLE_DEFINITIONS,
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
