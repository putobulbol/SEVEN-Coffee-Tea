(() => {
  const $ = id => document.getElementById(id);
  const profileForm = $("profileForm"), passwordForm = $("passwordForm"), notice = $("profileNotice");
  function show(message, kind = "") { notice.textContent = message; notice.className = "profile-notice" + (kind ? " " + kind : "") }
  const tabs = [{ tab: $("tabDetails"), panel: $("profileDetailsPanel") }, { tab: $("tabPassword"), panel: $("profilePasswordPanel") }];
  function selectTab(index, focus) {
    tabs.forEach(function (t, i) { const on = i === index; t.tab.classList.toggle("active", on); t.tab.setAttribute("aria-selected", String(on)); t.tab.tabIndex = on ? 0 : -1; t.panel.hidden = !on });
    show("");
    if (focus) tabs[index].tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.tab.addEventListener("click", function () { selectTab(i) });
    t.tab.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); selectTab((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true) } });
  });
  if (location.hash === "#password") selectTab(1);
  // New password: live checklist; "Change password" stays disabled until rules pass and confirmation matches.
  if (window.SevenPasswordPolicy) {
    const syncPasswordSubmit = function () { const ok = window.SevenPasswordPolicy.isValid($("newPassword").value) && $("confirmNewPassword").value === $("newPassword").value; $("changePassword").disabled = !ok };
    window.SevenPasswordPolicy.mountChecklist($("newPassword"), syncPasswordSubmit);
    $("confirmNewPassword").addEventListener("input", syncPasswordSubmit);
  }
  document.querySelectorAll("[data-toggle-password]").forEach(function (button) {
    button.addEventListener("click", function () { const input = $(button.dataset.togglePassword); const reveal = input.type === "password"; input.type = reveal ? "text" : "password"; button.textContent = reveal ? "Hide" : "Show"; button.setAttribute("aria-label", reveal ? "Hide password" : "Show password") });
  });
  async function request(method, body) {
    const response = await fetch("api/profile.php", { method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (response.status === 401) { window.location.href = "login.html"; throw new Error(data.message || "Please log in again.") }
    if (!response.ok || !data.ok) throw new Error(data.message || "Unable to complete the request.");
    return data;
  }
  async function load() {
    try { const d = await request("GET"); const p = d.profile; $("profileName").value = p.name || ""; $("profileContact").value = p.contact_number || ""; $("profileEmail").textContent = p.email || "—"; $("profileUsername").textContent = p.username || "—" }
    catch (e) { show(e.message || "Unable to load your profile.", "error") }
  }
  profileForm.addEventListener("submit", async e => {
    e.preventDefault(); const button = $("saveProfile"); button.disabled = true; button.textContent = "Saving…";
    try { const d = await request("PATCH", { action: "update_profile", name: $("profileName").value.trim(), contact_number: $("profileContact").value.trim() }); $("profileNameError").textContent = ""; $("profileContactError").textContent = ""; $("profileEmail").textContent = d.profile.email || "—"; $("profileUsername").textContent = d.profile.username || "—"; show(d.message || "Profile updated.", "success") }
    catch (error) { show(error.message || "Unable to save profile.", "error") }
    finally { button.disabled = false; button.textContent = "Save profile" }
  });
  passwordForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (window.SevenPasswordPolicy && !window.SevenPasswordPolicy.isValid($("newPassword").value)) { show(window.SevenPasswordPolicy.MESSAGE, "error"); $("newPassword").focus(); return }
    if ($("newPassword").value !== $("confirmNewPassword").value) { show("The new passwords do not match.", "error"); $("confirmNewPassword").focus(); return }
    const button = $("changePassword"); button.disabled = true; button.textContent = "Changing…";
    try { const d = await request("PATCH", { action: "change_password", current_password: $("currentPassword").value, new_password: $("newPassword").value }); passwordForm.reset(); passwordForm.querySelectorAll("input").forEach(function (i) { i.dispatchEvent(new Event("input")) }); show(d.message || "Password changed successfully.", "success") }
    catch (error) { show(error.message || "Unable to change password.", "error") }
    finally { button.disabled = false; button.textContent = "Change password"; $("newPassword").dispatchEvent(new Event("input")) }
  });
  $("profileLogout").addEventListener("click", async () => {
    const button = $("profileLogout"); button.disabled = true; button.textContent = "Logging out…";
    try { const response = await fetch("api/customer_auth.php", { method: "DELETE", credentials: "same-origin", cache: "no-store" }); const d = await response.json(); if (!response.ok || !d.ok) throw new Error(d.message || "Unable to log out."); window.location.href = "index.html" }
    catch (e) { show(e.message || "Unable to log out.", "error"); button.disabled = false; button.textContent = "Log Out" }
  });
  load();
})();
