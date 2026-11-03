/* =========================================================
   GEN-FREE APPLICATION CORE
   Shared login/profile + activity tracking + points + progress
   + page interactions + navigation + premium transitions.
========================================================= */

(function () {
    "use strict";

    const KEY = "genfreeApp";
    const SESSION = "genfreeSession";
    const SURVEY_API_URL = "https://script.google.com/macros/s/AKfycbzqA_Nq5ms5_cSFtAeIG0OmaAUbNN6D3qqMDJXrS3mp3SL4m_vjdHrsNeLU4dnKGImo/exec";
    const API_BASE = window.GENFREE_API_URL || "";
    const API_TOKEN = "genfreeApiToken";

    const pageMap = {
        index: "home",
        awareness: "awareness",
        risks: "risks",
        myths: "myths",
        pressure: "pressure",
        quiz: "quiz",
        findings: "findings",
        support: "support",
        progress: "progress",
        dashboard: "progress",
        feedback: "feedback",
        choices: "choices"
    };

    const activityCatalog = {
        home_scenario: { label: "Home scenario", points: 10 },
        awareness_explored: { label: "Awareness session completed", points: 15 },
        risks_explored: { label: "Risks explored", points: 10 },
        myths_explored: { label: "Myth vs Fact explored", points: 10 },
        pressure_scenario: { label: "Peer pressure scenario", points: 10 },
        quiz_completed: { label: "Awareness quiz completed", points: 20 },
        support_explored: { label: "Support resources explored", points: 10 },
        findings_explored: { label: "Survey findings explored", points: 5 },
        choices_explored: { label: "Informed choices explored", points: 10 },
        feedback_submitted: { label: "Feedback submitted", points: 5 }
    };

    const coreActivities = [
        "awareness_explored",
        "risks_explored",
        "myths_explored",
        "pressure_scenario",
        "choices_explored",
        "quiz_completed",
        "support_explored"
    ];

    const floatingHints = [
        "Choose water often",
        "Move your body daily",
        "Protect your sleep",
        "Stay close to supportive people",
        "Question risky pressure",
        "Build healthy routines",
        "Take breaks from stress",
        "Eat regular balanced meals",
        "Speak up when you need help",
        "Small healthy choices add up",
        "Avoid driving under the influence",
        "Trusted support is a strength"
    ];

    function getData() {
        try {
            const raw = localStorage.getItem(KEY);
            const data = raw ? JSON.parse(raw) : null;
            if (!data || typeof data !== "object") return { users: {}, currentUser: null };
            data.users = data.users || {};
            return data;
        } catch (error) {
            console.error("GEN-FREE storage error:", error);
            return { users: {}, currentUser: null };
        }
    }

    function saveData(data) {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
        } catch (error) {
            console.error("GEN-FREE could not save data:", error);
        }
    }

    async function backendRequest(path, options = {}) {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        const token = sessionStorage.getItem(API_TOKEN);
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) {
            const failure = new Error(data.message || `Backend request failed (${response.status})`);
            failure.status = response.status;
            throw failure;
        }
        return data;
    }

    async function syncUserToServer(user) {
        if (!user || !location.origin.startsWith("http")) return;
        const token = sessionStorage.getItem(API_TOKEN);
        if (!token) return;
        try {
            const safeUser = { ...user };
            delete safeUser.passwordHash;
            await backendRequest("/users/me", { method: "PUT", body: JSON.stringify(safeUser), keepalive: true });
        } catch (error) {
            // Local storage remains available if the backend is offline.
        }
    }

    function normalizeUser(user) {
        user.completed = user.completed || {};
        user.activities = Array.isArray(user.activities) ? user.activities : [];
        user.quizAttempts = Array.isArray(user.quizAttempts) ? user.quizAttempts : [];
        user.pageVisits = user.pageVisits || {};
        user.scenarioAnswers = Array.isArray(user.scenarioAnswers) ? user.scenarioAnswers : [];
        user.mythInteractions = Array.isArray(user.mythInteractions) ? user.mythInteractions : [];
        user.pressureAnswers = Array.isArray(user.pressureAnswers) ? user.pressureAnswers : [];
        user.riskCards = Array.isArray(user.riskCards) ? user.riskCards : [];
        user.supportItems = Array.isArray(user.supportItems) ? user.supportItems : [];
        user.findingsViewed = Array.isArray(user.findingsViewed) ? user.findingsViewed : [];
        user.feedback = Array.isArray(user.feedback) ? user.feedback : [];
        user.points = Number(user.points) || 0;
        return user;
    }

    function currentUser() {
        const data = getData();
        const email = sessionStorage.getItem(SESSION) || data.currentUser;
        if (!email || !data.users[email]) return null;
        return normalizeUser(data.users[email]);
    }

    function makeUser(name, email, profile) {
        const now = new Date().toISOString();
        return {
            name,
            email,
            profile: profile || "General",
            createdAt: now,
            lastLogin: now,
            points: 0,
            completed: {},
            activities: [],
            quizAttempts: [],
            quizBest: null,
            pageVisits: {},
            scenarioAnswers: [],
            mythInteractions: [],
            pressureAnswers: [],
            riskCards: [],
            supportItems: [],
            findingsViewed: [],
            feedback: []
        };
    }

    function ensureLoggedIn() {
        if (!currentUser()) {
            showAuthModal("login");
            return false;
        }
        return true;
    }

    function updateUser(mutator) {
        const data = getData();
        const email = sessionStorage.getItem(SESSION) || data.currentUser;
        if (!email || !data.users[email]) return null;

        const user = normalizeUser(data.users[email]);
        mutator(user);
        data.users[email] = user;
        data.currentUser = email;
        saveData(data);
        void syncUserToServer(user);
        window.dispatchEvent(new CustomEvent("genfree:updated"));
        return user;
    }

    function addActivity(type, detail, options = {}) {
        const user = currentUser();
        if (!user) return null;

        const catalog = activityCatalog[type] || { label: detail || type, points: 0 };
        const once = options.once !== false;
        const alreadyCompleted = !!user.completed[type];
        const shouldAwardPoints = options.award === false ? false : (!once || !alreadyCompleted);
        const pointValue = Number.isFinite(options.points) ? options.points : catalog.points;
        let awarded = 0;

        const updated = updateUser((u) => {
            awarded = shouldAwardPoints ? pointValue : 0;
            u.activities.unshift({
                type,
                label: catalog.label,
                detail: detail || "",
                points: awarded,
                timestamp: new Date().toISOString()
            });
            if (shouldAwardPoints) u.points += pointValue;
            u.completed[type] = true;
        });

        refreshHeader();
        return updated;
    }

    function recordPageVisit(page) {
        if (!currentUser()) return;
        updateUser((u) => {
            u.pageVisits[page] = (u.pageVisits[page] || 0) + 1;
        });
    }

    function progressPercent(user) {
        if (!user) return 0;
        const done = coreActivities.filter((x) => user.completed[x]).length;
        return Math.round((done / coreActivities.length) * 100);
    }

    function levelForPoints(points) {
        if (points >= 80) return "GEN-FREE Ready";
        if (points >= 55) return "Informed";
        if (points >= 25) return "Aware";
        return "Beginner";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
        }[char]));
    }

    function basePath() {
        return location.pathname.includes("/pages/") ? "../" : "";
    }

    function progressPath() {
        return `${basePath()}pages/progress.html`;
    }

    function awarenessPath() {
        return `${basePath()}pages/awareness.html`;
    }

    function addGlobalStyles() {
        if (document.getElementById("genfree-app-styles")) return;
        const style = document.createElement("style");
        style.id = "genfree-app-styles";
        style.textContent = `
            :root{scroll-behavior:smooth}
            body.gf-page-ready{opacity:1;transform:none;transition:opacity .45s ease,transform .45s ease}
            body.gf-page-prep{opacity:0;transform:translateY(8px)}
            body.gf-page-leaving{opacity:0;transform:translateY(-6px);pointer-events:none}
            .gf-page-transition{position:fixed;inset:0;background:rgba(5,12,18,.92);backdrop-filter:blur(18px);z-index:100000;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s ease}
            .gf-page-transition.show{opacity:1;pointer-events:auto}
            .gf-page-transition .gf-transition-core{display:grid;gap:10px;text-align:center;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:rgba(255,255,255,.7)}
            .gf-page-transition .gf-loader{width:140px;height:2px;background:rgba(255,255,255,.12);overflow:hidden}
            .gf-page-transition .gf-loader i{display:block;width:45%;height:100%;background:#fff;animation:gfLoader 1s ease-in-out infinite}
            @keyframes gfLoader{0%{transform:translateX(-120%)}50%{transform:translateX(120%)}100%{transform:translateX(240%)}}
            .gf-auth-backdrop{position:fixed;inset:0;background:rgba(3,10,15,.76);backdrop-filter:blur(16px);z-index:99999;display:grid;place-items:center;padding:20px;animation:gfFade .2s ease}
            .gf-auth{width:min(470px,100%);background:rgba(12,23,31,.98);border:1px solid rgba(255,255,255,.15);border-radius:24px;box-shadow:0 30px 100px rgba(0,0,0,.45);padding:30px;color:#fff}
            .gf-auth h2{margin:0 0 8px;font-size:30px}.gf-auth p{opacity:.72;line-height:1.6}.gf-auth-tabs{display:flex;gap:8px;margin:22px 0}.gf-auth-tabs button,.gf-action{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;padding:11px 16px;border-radius:12px;cursor:pointer}.gf-auth-tabs button.active{background:rgba(255,255,255,.15)}
            .gf-form{display:grid;gap:12px}.gf-form label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}.gf-form input,.gf-form select{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#fff;outline:none}.gf-form option{color:#111}.gf-submit{margin-top:6px;border:0;border-radius:13px;padding:14px;background:#fff;color:#071015;font-weight:700;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}.gf-submit:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(255,255,255,.12)}.gf-error{color:#ff9d9d;font-size:13px;min-height:18px}.gf-demo{margin-top:12px;text-align:center;font-size:12px;opacity:.6;cursor:pointer}.gf-close{float:right;background:none;border:0;color:#fff;font-size:22px;cursor:pointer;opacity:.7}
            .gf-userbar{display:flex;align-items:center;gap:10px;margin-left:12px}.gf-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);font-size:12px}.gf-user-link{font-size:12px!important;text-decoration:none!important;opacity:.85}.gf-logout{border:0;background:none;color:inherit;opacity:.65;cursor:pointer;font-size:12px}
            .gf-feedback{margin:18px 0 0;padding:18px 20px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.055);animation:gfIn .35s ease}.gf-feedback strong{display:block;margin-bottom:5px}.gf-points{font-size:12px;opacity:.7;margin-top:8px}.gf-visible{opacity:1!important;transform:none!important}.gf-complete{outline:1px solid rgba(255,255,255,.22);transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,.16)}
            .gf-dashboard{max-width:1180px;margin:0 auto;padding:80px 24px}.gf-dashboard-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:30px 0}.gf-stat{padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.045);transition:.25s}.gf-stat:hover{transform:translateY(-3px);background:rgba(255,255,255,.07)}.gf-stat span{display:block;font-size:11px;letter-spacing:.1em;opacity:.6;text-transform:uppercase}.gf-stat strong{display:block;font-size:30px;margin-top:8px}.gf-progress{height:9px;background:rgba(255,255,255,.09);border-radius:999px;overflow:hidden}.gf-progress i{display:block;height:100%;background:currentColor;border-radius:999px;transition:width .9s cubic-bezier(.22,.8,.22,1)}.gf-section{margin-top:34px}.gf-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.gf-card-link{display:block;text-decoration:none;color:inherit;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.045);transition:.25s}.gf-card-link:hover{transform:translateY(-4px);background:rgba(255,255,255,.08);box-shadow:0 20px 55px rgba(0,0,0,.12)}.gf-activity-list{display:grid;gap:8px}.gf-activity{display:flex;justify-content:space-between;gap:15px;padding:13px 15px;border-radius:12px;background:rgba(255,255,255,.045);font-size:13px}.gf-muted{opacity:.6}.gf-report{padding:25px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:rgba(255,255,255,.045)}
            .gf-score-table{display:grid;gap:10px}.gf-score-row{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:center;padding:14px 16px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}.gf-score-row strong{font-size:16px}.gf-score-badge{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}.gf-score-date{font-size:11px;opacity:.55}
            .gf-floating-hints{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:4}.gf-floating-hint{position:absolute;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(9,21,29,.64);backdrop-filter:blur(10px);font-size:11px;letter-spacing:.03em;opacity:0;white-space:nowrap;animation:gfFloat var(--gf-duration) ease-in-out var(--gf-delay) infinite;transform:translate3d(0,110vh,0) rotate(var(--gf-rot));color:rgba(255,255,255,.78)}@keyframes gfFloat{0%{opacity:0;transform:translate3d(0,115vh,0) rotate(var(--gf-rot))}12%{opacity:.72}84%{opacity:.72}100%{opacity:0;transform:translate3d(var(--gf-drift),-20vh,0) rotate(calc(var(--gf-rot) + 12deg))}}
            .healthy-ring{width:250px;height:250px;border-radius:50%;border:1px solid rgba(255,255,255,.18);display:grid;place-items:center;position:relative;box-shadow:0 0 70px rgba(255,255,255,.04)}.healthy-ring::before,.healthy-ring::after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.08)}.healthy-ring::before{inset:24px}.healthy-ring::after{inset:58px}.healthy-core{display:grid;gap:5px;text-align:center;z-index:1}.healthy-core strong{font-size:48px;line-height:1}.healthy-core span{font-size:10px;letter-spacing:.15em;opacity:.6}.gf-awareness-complete{margin-top:24px;display:inline-flex;align-items:center;gap:10px;padding:13px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:inherit;cursor:pointer;transition:.25s}.gf-awareness-complete:hover{transform:translateY(-2px);background:rgba(255,255,255,.11)}
            .gf-recommendations{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.gf-recommendation{padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:16px;background:rgba(255,255,255,.04);transition:.25s}.gf-recommendation:hover{transform:translateY(-3px);background:rgba(255,255,255,.065)}.gf-recommendation span{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin-bottom:8px}.gf-recommendation h3{margin:0 0 7px}.gf-recommendation p{margin:0;opacity:.72;line-height:1.6}
            .gf-survey-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.gf-survey-card{padding:20px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:rgba(255,255,255,.04)}.gf-survey-card strong{display:block;font-size:34px;margin:8px 0}.gf-survey-card span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.62}.gf-survey-card p{margin:0;opacity:.68;line-height:1.5;font-size:13px}
            .gf-ripple{position:absolute;border-radius:50%;transform:scale(0);animation:gfRipple .55s ease-out;background:rgba(255,255,255,.25);pointer-events:none}.gf-enhanced-interaction{position:relative;overflow:hidden}
            @keyframes gfRipple{to{transform:scale(5);opacity:0}}@keyframes gfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
            @media(max-width:950px){.gf-dashboard-grid,.gf-survey-grid{grid-template-columns:repeat(2,1fr)}.gf-actions,.gf-recommendations{grid-template-columns:1fr 1fr}}
            @media(max-width:700px){.gf-dashboard-grid,.gf-survey-grid,.gf-actions,.gf-recommendations{grid-template-columns:1fr}.gf-userbar{margin-left:0}.gf-auth{padding:24px}.gf-score-row{grid-template-columns:1fr}.gf-floating-hint{font-size:10px}}
            [role="button"]:focus-visible,.gf-menu-toggle:focus-visible,.gf-helpline a:focus-visible,.gf-retry:focus-visible{outline:2px solid #00ffc8;outline-offset:3px}
            .gf-menu-toggle{display:none;width:42px;height:42px;margin-left:10px;padding:0;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:5px}
            .gf-menu-toggle span{display:block;width:18px;height:2px;border-radius:2px;background:currentColor;transition:transform .25s ease,opacity .25s ease}
            .gf-nav-open .gf-menu-toggle span:nth-child(1){transform:translateY(7px) rotate(45deg)}
            .gf-nav-open .gf-menu-toggle span:nth-child(2){opacity:0}
            .gf-nav-open .gf-menu-toggle span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
            .gf-helpline{margin:0;padding:16px 5%;text-align:center;font-size:12px;letter-spacing:.02em;line-height:1.7;color:rgba(255,255,255,.62);border-top:1px solid rgba(255,255,255,.07)}
            .gf-helpline a{color:#00ffc8;text-decoration:none;font-weight:600}.gf-helpline a:hover{text-decoration:underline}
            a.gf-recommendation{display:block;text-decoration:none;color:inherit}.gf-retry{background:none;border:0;padding:0;margin-left:6px;font:inherit;color:#00ffc8;text-decoration:underline;cursor:pointer}
            .gf-guest-note{margin-top:22px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}.gf-guest-note button{margin-top:10px}
            @media(max-width:700px){.gf-menu-toggle{display:flex}.navbar{position:relative}.gf-nav-open .nav-links{display:flex!important;position:absolute;top:calc(100% + 10px);left:0;right:0;flex-direction:column;align-items:stretch;gap:4px;padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:rgba(8,15,30,.95);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.gf-nav-open .nav-links a{padding:12px 14px;border-radius:12px;font-size:13px}}
            @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.gf-page-transition,.gf-floating-hint{animation:none!important;transition:none!important}.gf-enhanced-interaction:hover{transform:none!important}}
        `;
        document.head.appendChild(style);
    }

    function setupTransitions() {
        document.body.classList.add("gf-page-prep");

        let overlay = document.querySelector(".gf-page-transition");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "gf-page-transition";
            overlay.innerHTML = '<div class="gf-transition-core"><span>GEN-FREE</span><div class="gf-loader"><i></i></div></div>';
            document.body.appendChild(overlay);
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => document.body.classList.replace("gf-page-prep", "gf-page-ready"));
        });

        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link || event.defaultPrevented) return;
            if (link.target === "_blank" || link.hasAttribute("download")) return;
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#") || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
            if (href === location.pathname.split("/").pop()) return;
            event.preventDefault();
            overlay.classList.add("show");
            document.body.classList.add("gf-page-leaving");
            setTimeout(() => { location.href = href; }, 180);
        }, true);
    }

    function addRippleEffects() {
        document.querySelectorAll(".primary-button, .secondary-button, .nav-button, .knowledge-button, .challenge-button, .findings-button, .support-button, .scenario-choice, .quiz-option, .quiz-next, .survey-button, .gf-submit, .gf-awareness-complete").forEach((element) => {
            if (element.dataset.gfRippleReady) return;
            element.dataset.gfRippleReady = "true";
            element.classList.add("gf-enhanced-interaction");
            element.addEventListener("click", function (event) {
                const rect = this.getBoundingClientRect();
                const ripple = document.createElement("span");
                ripple.className = "gf-ripple";
                const size = Math.max(rect.width, rect.height) * 0.7;
                ripple.style.width = `${size}px`;
                ripple.style.height = `${size}px`;
                ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
                this.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    function setupRevealEffects() {
        const targets = document.querySelectorAll("section, .explore-card, .risk-card, .finding-stat-card, .support-path-item, .comparison-myth, .comparison-fact, .quiz-card, .journey-step");
        if (!targets.length || !("IntersectionObserver" in window)) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("gf-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        targets.forEach((target) => {
            if (!target.classList.contains("gf-visible")) {
                target.style.transition = target.style.transition || "opacity .6s ease, transform .6s ease";
                if (!target.dataset.gfRevealPrepared) {
                    target.dataset.gfRevealPrepared = "true";
                    target.style.opacity = "0";
                    target.style.transform = "translateY(18px)";
                }
            }
        });
        targets.forEach((target) => observer.observe(target));
    }

    function showAuthModal(mode) {
        addGlobalStyles();
        if (document.querySelector(".gf-auth-backdrop")) return;

        const backdrop = document.createElement("div");
        backdrop.className = "gf-auth-backdrop";
        backdrop.innerHTML = `
            <div class="gf-auth" role="dialog" aria-modal="true">
                <button class="gf-close" aria-label="Close">×</button>
                <div class="section-eyebrow">GEN-FREE JOURNEY</div>
                <h2>Welcome to GEN-FREE</h2>
                <p>Save your awareness journey, choices, quiz scores and progress on this device.</p>
                <div class="gf-auth-tabs">
                    <button data-mode="login" class="${mode === "login" ? "active" : ""}">Log In</button>
                    <button data-mode="register" class="${mode === "register" ? "active" : ""}">Create Profile</button>
                </div>
                <div class="gf-auth-form"></div>
            </div>`;
        document.body.appendChild(backdrop);

        const render = (selected) => {
            const form = backdrop.querySelector(".gf-auth-form");
            const login = selected === "login";
            form.innerHTML = `
                <form class="gf-form">
                    ${!login ? `<div><label>Name</label><input name="name" required maxlength="40" placeholder="Your name"></div>` : ""}
                    <div><label>Email</label><input name="email" type="email" required placeholder="you@example.com"></div>
                    ${!login ? `<div><label>Profile</label><select name="profile"><option>Student</option><option>Working professional</option><option>General</option></select></div>` : ""}
                    <div><label>Password</label><input name="password" type="password" minlength="6" required placeholder="Minimum 6 characters"></div>
                    <div class="gf-error" aria-live="polite"></div>
                    <button class="gf-submit" type="submit">${login ? "Log In" : "Create My GEN-FREE Profile"}</button>
                </form>
                ${login ? `<div class="gf-demo" data-demo>Use Demo Profile instead</div>` : ""}`;

            backdrop.querySelectorAll(".gf-auth-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === selected));

            form.querySelector("form").addEventListener("submit", async (event) => {
                event.preventDefault();
                const fd = new FormData(event.currentTarget);
                const email = String(fd.get("email") || "").trim().toLowerCase();
                const password = String(fd.get("password") || "");
                const error = form.querySelector(".gf-error");
                const data = getData();

                try {
                    if (login) {
                        const result = await backendRequest("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
                        const existing = data.users[email] || {};
                        const user = normalizeUser({ ...result.user, passwordHash: existing.passwordHash }, existing);
                        data.users[email] = user;
                        data.currentUser = email;
                        saveData(data);
                        sessionStorage.setItem(SESSION, email);
                        sessionStorage.setItem(API_TOKEN, result.token);
                    } else {
                        const name = String(fd.get("name") || "").trim();
                        const profile = String(fd.get("profile") || "General");
                        const result = await backendRequest("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, profile }) });
                        const user = makeUser(name, email, profile);
                        user.passwordHash = await hashText(password);
                        Object.assign(user, result.user);
                        data.users[email] = normalizeUser(user);
                        data.currentUser = email;
                        saveData(data);
                        sessionStorage.setItem(SESSION, email);
                        sessionStorage.setItem(API_TOKEN, result.token);
                    }
                } catch (backendError) {
                    // If the server answered with a real rule (weak password, duplicate email, rate limit), show it.
                    // Only fall back to this-device-only mode when the server cannot be reached at all.
                    if (backendError.status === 429 || (!login && backendError.status && backendError.status < 500)) {
                        error.textContent = backendError.message;
                        return;
                    }
                    // Graceful local/demo fallback keeps the academic site usable offline.
                    if (login) {
                        const user = data.users[email];
                        if (!user) { error.textContent = backendError.message || "No profile found. Create a profile first."; return; }
                        const hash = await hashText(password);
                        if (user.passwordHash !== hash && !(email === "demo@genfree.local" && password === "demo")) {
                            error.textContent = "The password does not match this profile."; return;
                        }
                        user.lastLogin = new Date().toISOString(); data.currentUser = email; data.users[email] = normalizeUser(user); saveData(data); sessionStorage.setItem(SESSION, email);
                    } else {
                        if (data.users[email]) { error.textContent = "A profile with this email already exists. Log in instead."; return; }
                        const user = makeUser(String(fd.get("name") || "").trim(), email, String(fd.get("profile") || "General"));
                        user.passwordHash = await hashText(password); data.users[email] = user; data.currentUser = email; saveData(data); sessionStorage.setItem(SESSION, email);
                    }
                }

                const loggedInUser = currentUser();
                void syncUserToServer(loggedInUser);
                backdrop.remove();
                refreshHeader();
                window.dispatchEvent(new CustomEvent("genfree:login"));
                if (getCurrentPage() === "progress") renderDashboard();
            });

            const demo = form.querySelector("[data-demo]");
            if (demo) demo.addEventListener("click", () => createDemoProfile(backdrop));
        };

        backdrop.querySelector(".gf-close").addEventListener("click", () => backdrop.remove());
        backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.remove(); });
        backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") backdrop.remove(); });
        backdrop.querySelectorAll(".gf-auth-tabs button").forEach((button) => button.addEventListener("click", () => render(button.dataset.mode)));
        render(mode);
    }

    async function hashText(value) {
        if (window.crypto?.subtle) {
            const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
            return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        return btoa(unescape(encodeURIComponent(value)));
    }

    function createDemoProfile(backdrop) {
        const data = getData();
        const email = "demo@genfree.local";
        if (!data.users[email]) data.users[email] = makeUser("GEN-FREE User", email, "Demo");
        data.users[email].passwordHash = "demo";
        data.currentUser = email;
        saveData(data);
        sessionStorage.setItem(SESSION, email);
        backdrop.remove();
        refreshHeader();
        window.dispatchEvent(new CustomEvent("genfree:login"));
    }

    async function logout() {
        try { await backendRequest("/auth/logout", { method: "POST", body: "{}" }); } catch (_) {}
        sessionStorage.removeItem(API_TOKEN);
        sessionStorage.removeItem(SESSION);
        const data = getData();
        data.currentUser = null;
        saveData(data);
        refreshHeader();
        if (getCurrentPage() === "progress") renderDashboard();
    }

    function refreshHeader() {
        const nav = document.querySelector(".nav-links");
        if (!nav) return;
        document.querySelectorAll(".gf-userbar").forEach((el) => el.remove());
        const user = currentUser();
        const bar = document.createElement("div");
        bar.className = "gf-userbar";

        if (user) {
            const first = user.name.trim().charAt(0).toUpperCase() || "G";
            bar.innerHTML = `<span class="gf-avatar">${escapeHTML(first)}</span><a class="gf-user-link" href="${progressPath()}">${escapeHTML(user.name)}</a><button class="gf-logout">Log out</button>`;
            nav.parentElement.appendChild(bar);
            bar.querySelector(".gf-logout").addEventListener("click", logout);
        } else {
            bar.innerHTML = `<button class="gf-logout gf-login-link">Log In</button>`;
            nav.parentElement.appendChild(bar);
            bar.querySelector(".gf-login-link").addEventListener("click", () => showAuthModal("login"));
        }
        const toggle = nav.parentElement.querySelector(".gf-menu-toggle");
        if (toggle) nav.parentElement.appendChild(toggle);
    }

    function getCurrentPage() {
        const file = location.pathname.split("/").pop().replace(".html", "") || "index";
        return pageMap[file] || file;
    }

    function ensureFeedback(parent, title, text, points) {
        if (!parent) return null;
        let box = parent.querySelector(":scope > .gf-feedback");
        if (!box) {
            box = document.createElement("div");
            box.className = "gf-feedback";
            parent.appendChild(box);
        }
        box.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span>${points ? `<div class="gf-points">${escapeHTML(points)}</div>` : ""}`;
        return box;
    }

    function setupHomeScenario() {
        const choices = document.querySelectorAll(".scenario-choice");
        if (!choices.length) return;
        choices.forEach((choice, index) => {
            choice.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                choices.forEach((item) => item.classList.remove("selected", "gf-complete"));
                choice.classList.add("selected", "gf-complete");
                const outcomes = [
                    ["Clear boundary", "A clear response communicates your decision and protects your personal boundary."],
                    ["Remove the pressure", "Walking away can help you leave an uncomfortable situation before it escalates."],
                    ["Use support", "Talking to someone you trust can give you perspective and practical support."]
                ];
                const result = outcomes[index] || outcomes[0];
                ensureFeedback(choice.parentElement, result[0], result[1], "Scenario completed • +10 Awareness Points");
                updateUser((u) => u.scenarioAnswers.push({ choice: index + 1, timestamp: new Date().toISOString() }));
                addActivity("home_scenario", result[0], { once: true });
            });
        });
    }

    function setupPressure() {
        const options = document.querySelectorAll(".pressure-option");
        if (!options.length) return;
        options.forEach((option, index) => {
            option.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                options.forEach((item) => item.classList.remove("selected", "gf-complete"));
                option.classList.add("selected", "gf-complete");
                const messages = [
                    "A clear refusal can communicate your boundary without needing to justify every detail.",
                    "Leaving a pressured situation is a practical choice when the environment feels unsafe or uncomfortable.",
                    "Getting support from a trusted person can make difficult situations easier to handle."
                ];
                ensureFeedback(option.parentElement, "Healthy response", messages[index] || messages[0], "Peer pressure activity completed • +10 Points");
                updateUser((u) => u.pressureAnswers.push({ choice: index + 1, timestamp: new Date().toISOString() }));
                addActivity("pressure_scenario", `Response ${index + 1}`, { once: true });
            });
        });
    }

    function setupRisks() {
        const cards = document.querySelectorAll(".risk-card");
        if (!cards.length) return;
        cards.forEach((card, index) => {
            card.style.cursor = "pointer";
            card.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                const wasComplete = card.classList.contains("gf-complete");
                card.classList.add("gf-complete");
                if (!wasComplete) updateUser((u) => { if (!u.riskCards.includes(index + 1)) u.riskCards.push(index + 1); });
                if ([...cards].every((x) => x.classList.contains("gf-complete"))) {
                    ensureFeedback(card.parentElement, "Risk section complete", "You explored the major areas in which substance misuse can create problems.", "+10 Awareness Points");
                    addActivity("risks_explored", "All risk areas explored", { once: true });
                } else {
                    ensureFeedback(card.parentElement, "Risk area explored", "Keep exploring the remaining cards to complete this section.", "Explore every area to finish the activity");
                }
            });
        });
    }

    function setupMyths() {
        const cards = document.querySelectorAll(".comparison-myth, .comparison-fact, .myth-fact-card");
        if (!cards.length) return;
        cards.forEach((card, index) => {
            card.style.cursor = "pointer";
            card.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                const wasComplete = card.classList.contains("gf-complete");
                card.classList.add("gf-complete");
                if (!wasComplete) updateUser((u) => { if (!u.mythInteractions.includes(index + 1)) u.mythInteractions.push(index + 1); });
                const myths = document.querySelectorAll(".comparison-myth.gf-complete, .myth-card.gf-complete");
                const facts = document.querySelectorAll(".comparison-fact.gf-complete, .fact-card.gf-complete");
                const container = card.closest(".myth-comparison") || card.closest(".myth-fact-system") || card.parentElement;
                ensureFeedback(container, "Question the claim", "Compare the statement with the fact and look for reliable information before accepting a drug-related claim.", myths.length && facts.length ? "+10 Awareness Points • Section completed" : "Open both the myth and fact to complete the activity");
                if (myths.length && facts.length) addActivity("myths_explored", "Myth and fact compared", { once: true });
            });
        });
    }

    function setupSupport() {
        const items = document.querySelectorAll(".support-path-item");
        if (!items.length) return;
        items.forEach((item, index) => {
            item.style.cursor = "pointer";
            item.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                item.classList.add("gf-complete");
                updateUser((u) => { if (!u.supportItems.includes(index + 1)) u.supportItems.push(index + 1); });
                ensureFeedback(item.parentElement, "Support step explored", "You reviewed another practical way to seek or offer support.", "Explore the support section to complete your journey");
                if ([...items].every((x) => x.classList.contains("gf-complete"))) addActivity("support_explored", "All support steps explored", { once: true });
            });
        });
    }

    function setupFindings() {
        const cards = document.querySelectorAll(".finding-stat-card, .findings-category-card, .observation-card, .gf-survey-card");
        if (!cards.length) return;
        cards.forEach((card, index) => {
            card.style.cursor = "pointer";
            card.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                card.classList.add("gf-complete");
                updateUser((u) => { if (!u.findingsViewed.includes(index + 1)) u.findingsViewed.push(index + 1); });
                addActivity("findings_explored", `Finding ${index + 1}`, { once: true });
            });
        });
    }

    function setupAwareness() {
        const root = document.querySelector("[data-awareness-page]");
        if (!root) return;

        root.querySelectorAll("[data-awareness-card]").forEach((card) => {
            card.addEventListener("click", () => card.classList.toggle("gf-complete"));
        });

        const completeButton = root.querySelector("#awareness-complete");
        if (completeButton) {
            completeButton.addEventListener("click", () => {
                if (!ensureLoggedIn()) return;
                addActivity("awareness_explored", "Healthy living and drug-risk awareness reviewed", { once: true });
                completeButton.textContent = "Awareness Completed ✓";
                completeButton.disabled = true;
                ensureFeedback(completeButton.parentElement, "Well done", "You completed the awareness starter session. Keep using the healthy-life hints as reminders rather than rules.", "+15 Awareness Points");
            });
        }
    }

    function renderSurveyRecommendations(total, awareness, risk, support) {
        const box = document.getElementById("survey-recommendations");
        if (!box) return;
        const link = (file) => `${basePath()}pages/${file}`;
        if (!total) {
            box.innerHTML = `<div class="gf-recommendation"><span>Waiting for data</span><h3>No responses yet</h3><p>Recommendations appear here as soon as the first survey responses arrive.</p></div>`;
            return;
        }
        const items = [
            awareness < 60
                ? { label: "Awareness", title: "Strengthen the basics", text: `${awareness}% of respondents rate their knowledge 4 or 5. Start with the awareness session and Myth vs Fact.`, href: link("awareness.html"), cta: "Open Awareness" }
                : { label: "Awareness", title: "Build on strong awareness", text: `${awareness}% of respondents rate their knowledge 4 or 5. Keep the momentum going with the quiz.`, href: link("quiz.html"), cta: "Take the Quiz" },
            risk < 60
                ? { label: "Risk awareness", title: "Make the consequences clearer", text: `${risk}% recognise multiple consequence areas. Walk through health, mind, education and relationships.`, href: link("risks.html"), cta: "Know the Risks" }
                : { label: "Risk awareness", title: "Turn knowledge into decisions", text: `${risk}% recognise multiple consequence areas. Practise real choices and peer-pressure responses.`, href: link("choices.html"), cta: "Make Informed Choices" },
            support < 70
                ? { label: "Support", title: "Make help easier to find", text: `${support}% know where to seek help. Share the helplines and support pathways more widely.`, href: link("support.html"), cta: "Open Support" }
                : { label: "Support", title: "Keep support visible", text: `${support}% know where to seek help. Keep the helplines easy to reach on every page.`, href: link("support.html"), cta: "Open Support" }
        ];
        box.innerHTML = items.map((item) => `<a class="gf-recommendation" href="${escapeHTML(item.href)}"><span>${escapeHTML(item.label)}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p><p style="margin-top:10px;opacity:1;color:#00ffc8">${escapeHTML(item.cta)} →</p></a>`).join("");
    }

   async function loadSurveyResults() {

    const findingsRoot = document.querySelector("[data-findings-page]");

    const homeMainAwareness =
        document.getElementById("survey-main-awareness");

    const homeAwareness =
        document.getElementById("survey-awareness");

    const homeSupport =
        document.getElementById("survey-support");

    const hasSurveyTargets =
        findingsRoot ||
        homeMainAwareness ||
        homeAwareness ||
        homeSupport;

    if (!hasSurveyTargets) return;


    try {

        console.log("GEN-FREE: Loading survey data...");


        const response = await fetch(SURVEY_API_URL, { cache: "no-store", signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });


        if (!response.ok) {
            throw new Error(
                `Survey API returned ${response.status}`
            );
        }


        const data = await response.json();


        if (
            data.success !== true ||
            (!(data.summary && typeof data.summary === "object") && !Array.isArray(data.responses))
        ) {
            throw new Error(
                "Invalid survey data received from Google Apps Script."
            );
        }


        /*
         * Two supported feed formats:
         *  1) { success:true, summary:{ total, awareness, risk, support } }  (counts only, recommended: no personal data)
         *  2) { success:true, responses:[ ...raw sheet rows... ] }           (original format)
         * A summary is expanded into minimal rows so the same Q3/Q14/Q20 logic below is reused.
         */
        const hasSummary = !!(data.summary && typeof data.summary === "object");
        const total = hasSummary ? (Number(data.summary.total) || 0) : data.responses.length;
        const responses = hasSummary
            ? Array.from({ length: total }, (_, i) => ({
                "Q3.": i < (Number(data.summary.awareness) || 0) ? "5" : "1",
                "Q14.": i < (Number(data.summary.risk) || 0) ? "All of the above" : "",
                "Q20.": i < (Number(data.summary.support) || 0) ? "Yes" : "No"
            }))
            : data.responses;


        /*
         * Find a question using Q1, Q2, Q3... format.
         * Your Google Sheet uses headers such as:
         * Q3. ...
         * Q14. ...
         * Q20. ...
         */
        function findQuestion(response, questionNumber) {

            const key = Object.keys(response).find((header) => {

                const match = header
                    .trim()
                    .match(/^Q\s*0*(\d+)\s*\./i);

                return match &&
                       Number(match[1]) === questionNumber;
            });

            return key ? response[key] : "";
        }


        function clean(value) {

            return String(value ?? "")
                .trim()
                .toLowerCase();
        }


        function percentage(count) {

            if (!total) return 0;

            return Math.round(
                (count / total) * 100
            );
        }


        /*
         * Q3:
         * Current knowledge about drug abuse
         *
         * 4 or 5 = strong awareness
         */
        const awarenessValue = percentage(
            responses.filter((response) => {

                return Number(
                    findQuestion(response, 3)
                ) >= 4;

            }).length
        );


        /*
         * Q14:
         * Consequences students should be more aware of
         *
         * "All of the above" = recognising multiple
         * consequence areas.
         */
        const riskValue = percentage(
            responses.filter((response) => {

                return clean(
                    findQuestion(response, 14)
                ).includes("all of the above");

            }).length
        );


        /*
         * Q20:
         * Whether the student knows where to seek help.
         */
        const supportValue = percentage(
            responses.filter((response) => {

                return clean(
                    findQuestion(response, 20)
                ) === "yes";

            }).length
        );


        /*
         * ==========================================
         * HOMEPAGE SURVEY STATISTICS
         * ==========================================
         */

        function updateHomeStat(element, value) {

            if (!element) return;

            /*
             * Only put the number into the element.
             * The % sign is already present in the HTML.
             */
            element.textContent = value;
        }


        updateHomeStat(
            homeMainAwareness,
            awarenessValue
        );


        updateHomeStat(
            homeAwareness,
            awarenessValue
        );


        updateHomeStat(
            homeSupport,
            supportValue
        );


        /*
         * ==========================================
         * FULL FINDINGS PAGE
         * ==========================================
         */

        const grid =
            document.getElementById("survey-results-grid");


        if (grid) {

            const metrics = [

                {
                    id: "survey-total",
                    value: total,
                    label: "Survey responses",
                    note: "Total responses received"
                },

                {
                    id: "survey-awareness",
                    value: awarenessValue,
                    label: "Strong awareness",
                    note: "Students rating their knowledge 4 or 5"
                },

                {
                    id: "survey-risk",
                    value: riskValue,
                    label: "Risk awareness",
                    note: "Students recognising multiple consequences"
                },

                {
                    id: "survey-support",
                    value: supportValue,
                    label: "Support awareness",
                    note: "Students who know where to seek help"
                }

            ];


            grid.innerHTML = metrics.map((metric) => {

                const suffix =
                    metric.id === "survey-total"
                        ? ""
                        : "%";


                return `
                    <div class="gf-survey-card">

                        <span>${metric.label}</span>

                        <strong>
                            ${metric.value}${suffix}
                        </strong>

                        <p>
                            ${metric.note}
                        </p>

                    </div>
                `;

            }).join("");

        }


        const statusEl = document.getElementById("survey-status");
        const emptyEl = document.getElementById("survey-empty");
        if (statusEl) {
            statusEl.textContent = total
                ? `Based on ${total} survey ${total === 1 ? "response" : "responses"} • updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "No survey responses have been received yet.";
        }
        if (emptyEl) {
            emptyEl.hidden = total > 0;
            if (!total) emptyEl.textContent = "No responses yet. Be the first to take the survey.";
        }
        renderSurveyRecommendations(total, awarenessValue, riskValue, supportValue);
        if (grid) {
            grid.querySelectorAll(".gf-survey-card").forEach((card, index) => {
                card.style.cursor = "pointer";
                card.setAttribute("tabindex", "0");
                card.setAttribute("role", "button");
                const open = () => {
                    if (!ensureLoggedIn()) return;
                    card.classList.add("gf-complete");
                    updateUser((u) => { if (!u.findingsViewed.includes(index + 1)) u.findingsViewed.push(index + 1); });
                    addActivity("findings_explored", `Finding ${index + 1}`, { once: true });
                };
                card.addEventListener("click", open);
                card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
            });
        }

        /*
         * ==========================================
         * CONSOLE VERIFICATION
         * ==========================================
         */

        console.log(
            "GEN-FREE Survey Data Loaded:",
            {
                totalResponses: total,
                awareness: awarenessValue,
                risk: riskValue,
                support: supportValue
            }
        );


    } catch (error) {

        console.error(
            "GEN-FREE Survey Data Error:",
            error
        );


        // Show "unavailable" instead of a misleading 00%.
        [homeMainAwareness, homeAwareness, homeSupport].forEach((el) => {
            if (el && el.parentElement) el.parentElement.textContent = "—";
        });
        const failedStatus = document.getElementById("survey-status");
        if (failedStatus) {
            failedStatus.innerHTML = 'Live survey data is unavailable right now. <button type="button" class="gf-retry">Try again</button>';
            failedStatus.querySelector(".gf-retry").addEventListener("click", () => {
                failedStatus.textContent = "Loading survey responses…";
                loadSurveyResults();
            });
        }
        const failedGrid = document.getElementById("survey-results-grid");
        if (failedGrid) failedGrid.innerHTML = "";
        const failedRecs = document.getElementById("survey-recommendations");
        if (failedRecs) failedRecs.innerHTML = '<div class="gf-recommendation"><span>Unavailable</span><h3>Recommendations need survey data</h3><p>They will appear here once the survey feed loads.</p></div>';
    }
}

    function setupMobileMenu() {
        const nav = document.querySelector(".nav-links");
        const bar = nav && nav.parentElement;
        if (!bar || bar.querySelector(".gf-menu-toggle")) return;
        if (!nav.id) nav.id = "gf-nav-links";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "gf-menu-toggle";
        toggle.setAttribute("aria-label", "Open menu");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", nav.id);
        toggle.innerHTML = "<span></span><span></span><span></span>";
        const setOpen = (open) => {
            bar.classList.toggle("gf-nav-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        };
        toggle.addEventListener("click", () => setOpen(!bar.classList.contains("gf-nav-open")));
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
        window.addEventListener("resize", () => { if (window.innerWidth > 700) setOpen(false); });
        nav.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
        bar.appendChild(toggle);
    }

    function setupKeyboardAccess() {
        const selector = ".risk-card, .comparison-myth, .comparison-fact, .myth-fact-card, .support-path-item, .finding-stat-card, .findings-category-card, .observation-card, [data-awareness-card], .decision-choice";
        document.querySelectorAll(selector).forEach((el) => {
            if (el.matches("a, button, input, select, textarea") || el.hasAttribute("tabindex")) return;
            el.setAttribute("tabindex", "0");
            el.setAttribute("role", "button");
            el.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.click(); }
            });
        });
    }

    function injectHelpLine() {
        const footer = document.querySelector(".site-footer");
        if (!footer || footer.querySelector(".gf-helpline")) return;
        const line = document.createElement("p");
        line.className = "gf-helpline";
        line.innerHTML = 'Need help now? Call <a href="tel:14446">14446</a> (national de-addiction helpline) or <a href="tel:14416">14416</a> (Tele-MANAS). In an emergency, call <a href="tel:112">112</a>.';
        footer.appendChild(line);
    }

    function injectDashboardLink() {
        const nav = document.querySelector(".nav-links");
        if (!nav || nav.querySelector("[data-dashboard-link]") || nav.querySelector('a[href$="progress.html"]')) return;
        const link = document.createElement("a");
        link.dataset.dashboardLink = "true";
        link.href = progressPath();
        link.textContent = "My Progress";
        nav.appendChild(link);
    }

    function injectAwarenessLink() {
        const nav = document.querySelector(".nav-links");
        if (!nav || nav.querySelector("[data-awareness-link]") || nav.querySelector('a[href$="awareness.html"]')) return;
        const link = document.createElement("a");
        link.dataset.awarenessLink = "true";
        link.href = awarenessPath();
        link.textContent = "Awareness";
        nav.appendChild(link);
    }

    function renderDashboard() {
        const root = document.getElementById("genfree-dashboard-root");
        if (!root) return;
        addGlobalStyles();
        const user = currentUser();
        if (!user) {
            root.innerHTML = `<div class="gf-dashboard"><div class="gf-report"><div class="section-eyebrow">YOUR JOURNEY</div><h2>Log in to view your progress</h2><p class="gf-muted">Your activities, points and every quiz score will appear here.</p><button class="gf-submit" id="gf-dashboard-login">Log In</button></div></div>`;
            document.getElementById("gf-dashboard-login").addEventListener("click", () => showAuthModal("login"));
            return;
        }

        const progress = progressPercent(user);
        const recent = user.activities.slice(0, 8);
        const attempts = [...user.quizAttempts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const best = user.quizBest ? `${user.quizBest.score}/${user.quizBest.total}` : "—";
        const setBest = user.quizBest?.setName || "—";
        const scoreRows = attempts.length ? attempts.map((attempt) => `
            <div class="gf-score-row">
                <span><strong>${escapeHTML(attempt.score)}/${escapeHTML(attempt.total)}</strong><br><span class="gf-score-badge">${escapeHTML(attempt.setName || "Quiz Set")}</span></span>
                <span>${escapeHTML(attempt.percentage)}%</span>
                <span class="gf-score-date">${escapeHTML(new Date(attempt.timestamp).toLocaleString())}</span>
            </div>`).join("") : `<div class="gf-report gf-muted">No quiz attempts yet.</div>`;

        root.innerHTML = `
            <div class="gf-dashboard">
                <div class="section-eyebrow">MY GEN-FREE JOURNEY</div>
                <h1>Welcome back, <span>${escapeHTML(user.name)}</span></h1>
                <p class="gf-muted">Your awareness journey is saved on this device.</p>
                <div class="gf-dashboard-grid">
                    <div class="gf-stat"><span>Progress</span><strong>${progress}%</strong></div>
                    <div class="gf-stat"><span>Awareness Points</span><strong>${user.points}</strong></div>
                    <div class="gf-stat"><span>Quiz Best</span><strong>${escapeHTML(best)}</strong></div>
                    <div class="gf-stat"><span>Level</span><strong style="font-size:20px">${escapeHTML(levelForPoints(user.points))}</strong></div>
                </div>
                <div class="gf-progress" aria-label="Journey progress"><i style="width:${progress}%"></i></div>

                <div class="gf-section">
                    <div class="section-eyebrow">CONTINUE</div>
                    <div class="gf-actions">
                        <a class="gf-card-link" href="awareness.html"><strong>Awareness Session</strong><p class="gf-muted">Start with healthy-life habits and early warning signs.</p></a>
                        <a class="gf-card-link" href="risks.html"><strong>Know the Risks</strong><p class="gf-muted">Explore risk areas and complete the section.</p></a>
                        <a class="gf-card-link" href="myths.html"><strong>Myth vs Fact</strong><p class="gf-muted">Question claims and compare facts.</p></a>
                        <a class="gf-card-link" href="pressure.html"><strong>Peer Pressure</strong><p class="gf-muted">Practice a real-world response.</p></a>
                        <a class="gf-card-link" href="choices.html"><strong>Informed Choices</strong><p class="gf-muted">Work through decision scenarios.</p></a>
                        <a class="gf-card-link" href="quiz.html"><strong>Awareness Quiz</strong><p class="gf-muted">Take one of four rotating sets and track every score.</p></a>
                        <a class="gf-card-link" href="support.html"><strong>Support</strong><p class="gf-muted">Explore practical support pathways.</p></a>
                        <a class="gf-card-link" href="findings.html"><strong>Survey Findings</strong><p class="gf-muted">See the latest survey response summary and recommendations.</p></a>
                    </div>
                </div>

                <div class="gf-section">
                    <div class="section-eyebrow">QUIZ SCORE HISTORY</div>
                    <p class="gf-muted">Best score: ${escapeHTML(best)} • Best set: ${escapeHTML(setBest)} • Attempts: ${attempts.length}</p>
                    <div class="gf-score-table">${scoreRows}</div>
                </div>

                <div class="gf-section">
                    <div class="section-eyebrow">RECENT ACTIVITY</div>
                    <div class="gf-activity-list">
                        ${recent.length ? recent.map((a) => `<div class="gf-activity"><span><strong>${escapeHTML(a.label)}</strong><br><span class="gf-muted">${escapeHTML(a.detail || "Completed")}</span></span><span class="gf-muted">${a.points ? "+" + a.points : "Viewed"}</span></div>`).join("") : `<div class="gf-report gf-muted">No activity yet. Start with Awareness or the Risks section.</div>`}
                    </div>
                </div>

                <div class="gf-section gf-report">
                    <div class="section-eyebrow">YOUR REPORT</div>
                    <h2>${progress === 100 ? "Journey completed" : "Keep going"}</h2>
                    <p>${progress === 100 ? "You completed the core GEN-FREE journey. Review the sections again whenever you want." : `You have completed ${progress}% of the core journey. Continue exploring to build your awareness.`}</p>
                </div>
            </div>`;
    }

    function init() {
        addGlobalStyles();
        setupTransitions();
        injectAwarenessLink();
        injectDashboardLink();
        refreshHeader();
        setupMobileMenu();
        injectHelpLine();
        const page = getCurrentPage();
        recordPageVisit(page);

        setupHomeScenario();
        setupPressure();
        setupRisks();
        setupMyths();
        setupSupport();
        setupFindings();
        setupAwareness();
        renderDashboard();
        loadSurveyResults();
        addRippleEffects();
        setupRevealEffects();
        setupKeyboardAccess();

        if (page === "home") {
            document.querySelectorAll('a[href="#awareness"]').forEach((link) => { link.setAttribute("href", awarenessPath()); });
        }
    }

    window.GENFREE = {
        getUser: currentUser,
        getData,
        addActivity,
        updateUser,
        progressPercent,
        levelForPoints,
        showAuthModal,
        logout,
        renderDashboard,
        progressPath,
        awarenessPath,
        SURVEY_API_URL,
        API_BASE,
        backendRequest
    };

    document.addEventListener("DOMContentLoaded", init);
    window.addEventListener("genfree:updated", () => {
        if (getCurrentPage() === "progress") renderDashboard();
    });
})();
