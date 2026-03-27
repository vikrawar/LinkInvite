const form = document.getElementById("inviteForm");
const startInput = document.getElementById("start_time");
const durationInput = document.getElementById("duration");
const inviteeInput = document.getElementById("invitee_email");
const addEmailBtn = document.getElementById("addEmailBtn");
const emailPills = document.getElementById("emailPills");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const submitIcon = document.getElementById("submitIcon");
const bannerHost = document.getElementById("bannerHost");
const toastHost = document.getElementById("toastHost");
const inviteeError = document.getElementById("inviteeError");
const smtpChip = document.getElementById("smtpChip");

// localStorage key for warnings that should survive page refreshes.
const PERSIST_KEY = "linkinvite_persistent_banner";
// Backend injects SMTP availability via a data attribute on <body>.
const smtpReady = document.body.dataset.smtpReady === "true";
/** @type {string[]} */
const inviteeEmails = [];
// Track the active toast timeout so consecutive toasts do not overlap.
let toastTimer = null;

function isValidEmail(value) {
  // Lightweight syntax validation for immediate UX feedback.
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return emailRegex.test((value || "").trim());
}

function setInviteeError(message = "") {
  inviteeError.textContent = message;
}

function setPersistentBanner(message, tone = "warn") {
  // Store only minimal metadata required to re-render the banner.
  const payload = { message, tone };
  localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  renderBanners();
}

function clearPersistentBanner() {
  localStorage.removeItem(PERSIST_KEY);
  renderBanners();
}

function addBanner(message, tone = "info", dismissible = false) {
  const banner = document.createElement("div");
  banner.className = `banner ${tone}`;
  const text = document.createElement("div");
  text.className = "banner-text";
  text.textContent = message;
  banner.appendChild(text);
  if (dismissible) {
    const actions = document.createElement("div");
    actions.className = "banner-actions";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Dismiss";
    close.className = "secondary";
    close.addEventListener("click", clearPersistentBanner);
    actions.appendChild(close);
    banner.appendChild(actions);
  }
  bannerHost.appendChild(banner);
}

function showToast(message, tone = "info", timeoutMs = 4500) {
  // Guard in case host node is absent in unexpected DOM states.
  if (!toastHost) return;
  toastHost.innerHTML = "";
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;

  const text = document.createElement("div");
  text.className = "toast-text";
  text.textContent = message;
  toast.appendChild(text);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.className = "secondary";
  close.addEventListener("click", () => {
    toastHost.innerHTML = "";
  });
  toast.appendChild(close);
  toastHost.appendChild(toast);

  toastTimer = setTimeout(() => {
    toastHost.innerHTML = "";
    toastTimer = null;
  }, timeoutMs);
}

function renderSmtpChip() {
  // Show startup mode clearly when backend is download-only.
  if (!smtpChip) return;
  smtpChip.innerHTML = "";
  if (!smtpReady) {
    const chip = document.createElement("div");
    chip.className = "status-chip";
    chip.textContent = "SMTP not configured — download-only mode";
    smtpChip.appendChild(chip);
  }
}

function renderBanners() {
  bannerHost.innerHTML = "";

  // Persisted banners survive refresh until the user dismisses them.
  const saved = localStorage.getItem(PERSIST_KEY);
  if (!saved) {
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    addBanner(parsed.message, parsed.tone || "warn", true);
  } catch (err) {
    localStorage.removeItem(PERSIST_KEY);
  }
}

function renderPills() {
  emailPills.innerHTML = "";
  inviteeEmails.forEach((email) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = email;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "x";
    // Accessibility label for screen readers.
    removeBtn.ariaLabel = `Remove ${email}`;
    removeBtn.addEventListener("click", () => {
      const idx = inviteeEmails.indexOf(email);
      if (idx >= 0) {
        inviteeEmails.splice(idx, 1);
      }
      renderPills();
      updateSubmitState();
    });

    pill.appendChild(removeBtn);
    emailPills.appendChild(pill);
  });
}

function updateSubmitState() {
  // Start time and duration are the only required fields for file generation.
  const ready = Boolean(startInput.value) && Boolean(durationInput.value);
  submitBtn.disabled = !ready;

  // Button copy reflects "download only" vs "send + download" intent.
  const inputHasValidEmail = isValidEmail(inviteeInput.value);
  const hasValidEmail = inviteeEmails.length > 0 || inputHasValidEmail;

  submitText.textContent = hasValidEmail ? "Send & Save" : "Download";
  submitIcon.textContent = hasValidEmail ? "✉" : "⬇";
}

function tryAddEmail() {
  const candidate = inviteeInput.value.trim();
  if (!candidate) {
    setInviteeError("");
    return;
  }
  if (!isValidEmail(candidate)) {
    setInviteeError("Please enter a valid email address.");
    return;
  }
  setInviteeError("");
  if (!inviteeEmails.includes(candidate)) {
    // De-duplicate exact matches to keep payload clean.
    inviteeEmails.push(candidate);
  }
  inviteeInput.value = "";
  renderPills();
  updateSubmitState();
}

addEmailBtn.addEventListener("click", tryAddEmail);
inviteeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    // Enter in the email field adds an address instead of submitting form.
    event.preventDefault();
    tryAddEmail();
  }
});

[startInput, durationInput, inviteeInput].forEach((el) => {
  el.addEventListener("input", updateSubmitState);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitBtn.disabled) {
    return;
  }

  // Include current email input as a recipient if valid.
  if (isValidEmail(inviteeInput.value.trim())) {
    tryAddEmail();
  } else if (inviteeInput.value.trim()) {
    setInviteeError("Please enter a valid email address (or clear the field).");
    return;
  }

  const localDate = new Date(startInput.value);
  // Client timezone is informational; backend uses UTC for ICS timestamps.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Null values allow backend defaults/fallbacks to apply consistently.
  const payload = {
    title: document.getElementById("title").value || null,
    your_name: document.getElementById("your_name").value || null,
    // datetime-local is interpreted in local time, then normalized to UTC.
    start_time_utc: localDate.toISOString(),
    duration_hours: Number(durationInput.value),
    location: document.getElementById("location").value || null,
    invitee_emails: inviteeEmails,
    custom_subject: document.getElementById("custom_subject").value || null,
    custom_body: document.getElementById("custom_body").value || null,
    timezone
  };

  const response = await fetch("/invite.ics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const mailStatus = response.headers.get("X-LinkInvite-Mail-Status") || "";
  // Backend always returns the ICS file; headers are the status side-channel.
  const mailMessage =
    response.headers.get("X-LinkInvite-Mail-Message") ||
    "Invite downloaded.";

  const blob = await response.blob();
  const fileUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = fileUrl;
  anchor.download = "linkinvite-invite.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Release temporary object URL to avoid leaking memory.
  URL.revokeObjectURL(fileUrl);

  // Keep SMTP configuration warnings visible across reloads.
  if (mailStatus === "smtp_not_configured") {
    setPersistentBanner(mailMessage, "warn");
    showToast(mailMessage, "warn", 6000);
    return;
  }

  renderBanners();
  // A failed send still means download succeeded; message tone communicates this.
  if (mailStatus === "failed") {
    showToast(mailMessage, "warn", 7000);
  } else {
    showToast(mailMessage, "info", 4500);
  }
});

renderSmtpChip();
renderBanners();
updateSubmitState();
