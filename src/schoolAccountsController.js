import { escapeHtml } from "./socialUi.js";

function cleanUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

export function createSchoolAccountsController({
  apiJson,
  elements,
  getAuthInfo,
  currentNextPath,
}) {
  const {
    schoolLoginForm,
    schoolLoginUsername,
    schoolLoginPassword,
    schoolLoginMessage,
    schoolLoginSubmit,
    schoolAdminCard,
    schoolAccountCreate,
    schoolAccountUsername,
    schoolAccountPassword,
    schoolAccountCreateSubmit,
    schoolAccountMessage,
    schoolAccountList,
  } = elements;

  const state = {
    busyKey: "",
    error: "",
    loaded: false,
    loading: false,
    message: "",
    users: [],
  };

  function renderMessage(element, message, { success = false } = {}) {
    element.textContent = message || "";
    element.className = `school-account-message${message ? " visible" : ""}${success ? " success" : ""}`;
  }

  function renderLogin() {
    const authInfo = getAuthInfo();
    schoolLoginForm.hidden = !authInfo.schoolAuthEnabled || !!authInfo.user;
    renderMessage(schoolLoginMessage, state.error);
  }

  function accountRow(user) {
    const busy = state.busyKey === user.id;
    return `
      <article class="school-account-row" data-school-user-id="${escapeHtml(user.id)}">
        <div class="school-account-fields">
          <input data-school-field="username" value="${escapeHtml(user.username || "")}" placeholder="Account name" maxlength="20" ${busy ? "disabled" : ""} />
          <input data-school-field="password" type="password" placeholder="New password" autocomplete="new-password" ${busy ? "disabled" : ""} />
        </div>
        <div class="school-account-actions">
          <button class="sm-btn primary-mini" type="button" data-school-action="save" ${busy ? "disabled" : ""}>${busy ? "Saving..." : "Save"}</button>
          <button class="sm-btn" type="button" data-school-action="delete" ${busy ? "disabled" : ""}>Delete</button>
        </div>
      </article>
    `;
  }

  function renderAdmin() {
    const authInfo = getAuthInfo();
    const canManage = !!authInfo.user?.isAdmin;
    schoolAdminCard.hidden = !canManage;
    if (!canManage) {
      state.users = [];
      state.loaded = false;
      renderMessage(schoolAccountMessage, "");
      schoolAccountList.innerHTML = "";
      return;
    }
    renderMessage(schoolAccountMessage, state.message || state.error, { success: !!state.message && !state.error });
    schoolAccountCreateSubmit.disabled = !!state.busyKey;
    schoolAccountList.innerHTML = state.loading
      ? `<div class="empty-state school-account-empty">Loading accounts...</div>`
      : state.users.length
        ? state.users.map(accountRow).join("")
        : `<div class="empty-state school-account-empty">No managed accounts yet.</div>`;
  }

  async function loadAccounts({ force = false } = {}) {
    const authInfo = getAuthInfo();
    if (!authInfo.user?.isAdmin) {
      renderAdmin();
      return;
    }
    if (state.loading || (state.loaded && !force)) {
      renderAdmin();
      return;
    }
    state.loading = true;
    state.error = "";
    renderAdmin();
    try {
      const payload = await apiJson("/api/admin/test-users");
      state.users = payload.users || [];
      state.loaded = true;
    } catch (err) {
      state.error = err.message;
      state.users = [];
    } finally {
      state.loading = false;
      renderAdmin();
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    state.error = "";
    renderLogin();
    schoolLoginSubmit.disabled = true;
    try {
      const params = new URLSearchParams(location.search);
      const requestedNext = params.get("next");
      const next = params.get("auth") === "login"
        ? requestedNext?.startsWith("/") ? requestedNext : "/"
        : currentNextPath();
      const payload = await apiJson("/api/auth/school-login", {
        method: "POST",
        body: JSON.stringify({
          username: cleanUsername(schoolLoginUsername.value),
          password: schoolLoginPassword.value,
          next,
        }),
      });
      location.href = payload.next || "/";
    } catch (err) {
      state.error = err.message;
      schoolLoginPassword.value = "";
      renderLogin();
    } finally {
      schoolLoginSubmit.disabled = false;
    }
  }

  async function submitCreate(event) {
    event.preventDefault();
    state.error = "";
    state.message = "";
    state.busyKey = "create";
    renderAdmin();
    try {
      const payload = await apiJson("/api/admin/test-users", {
        method: "POST",
        body: JSON.stringify({
          username: cleanUsername(schoolAccountUsername.value),
          password: schoolAccountPassword.value,
        }),
      });
      state.message = payload.message || "Account created.";
      schoolAccountCreate.reset();
      await loadAccounts({ force: true });
    } catch (err) {
      state.error = err.message;
    } finally {
      state.busyKey = "";
      renderAdmin();
    }
  }

  function accountPayload(row) {
    return {
      username: cleanUsername(row.querySelector('[data-school-field="username"]').value),
      password: row.querySelector('[data-school-field="password"]').value,
    };
  }

  async function handleListClick(event) {
    const button = event.target.closest("[data-school-action]");
    if (!button) return;
    const row = button.closest("[data-school-user-id]");
    const userId = row?.dataset.schoolUserId;
    if (!userId) return;
    const action = button.dataset.schoolAction;
    state.error = "";
    state.message = "";
    state.busyKey = userId;
    renderAdmin();
    try {
      if (action === "save") {
        const payload = await apiJson(`/api/admin/test-users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: JSON.stringify(accountPayload(row)),
        });
        state.message = payload.message || "Account updated.";
      } else if (action === "delete") {
        const user = state.users.find(candidate => candidate.id === userId);
        const ok = window.confirm(`Delete ${user?.username || "this account"}?`);
        if (!ok) return;
        const payload = await apiJson(`/api/admin/test-users/${encodeURIComponent(userId)}`, { method: "DELETE" });
        state.message = payload.message || "Account deleted.";
      }
      await loadAccounts({ force: true });
    } catch (err) {
      state.error = err.message;
    } finally {
      state.busyKey = "";
      renderAdmin();
    }
  }

  function bindEvents() {
    schoolLoginForm.addEventListener("submit", submitLogin);
    schoolLoginUsername.addEventListener("input", () => {
      schoolLoginUsername.value = cleanUsername(schoolLoginUsername.value);
    });
    schoolAccountCreate.addEventListener("submit", submitCreate);
    schoolAccountUsername.addEventListener("input", () => {
      schoolAccountUsername.value = cleanUsername(schoolAccountUsername.value);
    });
    schoolAccountList.addEventListener("click", handleListClick);
  }

  function render() {
    renderLogin();
    renderAdmin();
  }

  return {
    bindEvents,
    loadAccounts,
    render,
  };
}
