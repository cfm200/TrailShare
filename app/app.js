const API_BASE = "https://trailshare-function-app-dfa7adbdhxfehjek.francecentral-01.azurewebsites.net/api";

let latestTrails = [];

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function getDisplayDate(trail) {
  return formatDate(trail.createdAt || trail.updatedAt);
}

function setMsg(text = "", isError = false) {
  const el = document.getElementById("msg");
  el.textContent = text;
  el.style.color = isError ? "#fca5a5" : "";
}

/* ---------- modal ---------- */
function openTrailModal(trail) {
  document.getElementById("modalTitle").textContent = trail.title || "(untitled)";

  const meta = [];
  if (trail.location) meta.push(`📍 ${trail.location}`);
  const when = getDisplayDate(trail);
  if (when) meta.push(`Uploaded ${when}`);
  document.getElementById("modalMeta").textContent = meta.join(" · ");

  document.getElementById("modalDesc").textContent = trail.description || "";

  const imgWrap = document.getElementById("modalImageWrap");
  const img = document.getElementById("modalImage");

  if (trail.imageUrl) {
    img.src = trail.imageUrl;
    imgWrap.classList.remove("hidden");
  } else {
    imgWrap.classList.add("hidden");
  }

  document.getElementById("modalEdit").onclick = () => {
    closeTrailModal();
    editTrail(trail.trailId);
  };

  document.getElementById("modalDelete").onclick = () => {
    closeTrailModal();
    delTrail(trail.trailId);
  };

  document.getElementById("trailModal").classList.remove("hidden");
}

function closeTrailModal() {
  document.getElementById("trailModal").classList.add("hidden");
}

/* ---------- blob upload ---------- */
async function uploadSelectedImage() {
  const file = document.getElementById("image")?.files?.[0];
  if (!file) return null;

  const sasRes = await fetch(`${API_BASE}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type }),
  });

  const { uploadUrl, imageUrl } = await sasRes.json();

  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type,
    },
    body: file,
  });

  return imageUrl;
}

/* ---------- rendering ---------- */
function renderTrailCard(t) {
  const card = document.createElement("div");
  card.className = "trail";

  card.innerHTML = `
    <h3 class="trail__title">${escapeHtml(t.title)}</h3>
    <p class="trail__meta">
      ${t.location ? `📍 ${escapeHtml(t.location)} · ` : ""}
      Uploaded ${getDisplayDate(t)}
    </p>
    <p class="trail__desc">${escapeHtml(t.description || "")}</p>
    ${t.imageUrl ? `
      <div class="trail__img">
        <img src="${t.imageUrl}" loading="lazy" />
      </div>` : ""}
    <div class="trail__actions">
      <button class="btn btn--ghost">Edit</button>
      <button class="btn btn--danger">Delete</button>
    </div>
  `;

  card.onclick = () => openTrailModal(t);

  card.querySelector(".btn--ghost").onclick = (e) => {
    e.stopPropagation();
    editTrail(t.trailId);
  };

  card.querySelector(".btn--danger").onclick = (e) => {
    e.stopPropagation();
    delTrail(t.trailId);
  };

  return card;
}

/* ---------- API ---------- */
async function refresh() {
  const res = await fetch(`${API_BASE}/trails`);
  latestTrails = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  if (!latestTrails.length) {
    list.innerHTML = `<div class="empty">No trails yet</div>`;
    return;
  }

  latestTrails.forEach((t) => list.appendChild(renderTrailCard(t)));
}

async function createTrail() {
  try {
    const title = titleEl.value.trim();
    const description = descriptionEl.value.trim();
    const location = locationEl.value.trim();

    if (!title) {
      setMsg("Title is required", true);
      return;
    }

    let imageUrl = null;
    if (image.files.length) imageUrl = await uploadSelectedImage();

    await fetch(`${API_BASE}/trails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, location, imageUrl }),
    });

    titleEl.value = "";
    descriptionEl.value = "";
    locationEl.value = "";
    image.value = "";

    setMsg("Created!");
    refresh();
  } catch (e) {
    setMsg("Failed to create trail", true);
  }
}

async function editTrail(trailId) {
  const t = latestTrails.find(x => x.trailId === trailId);
  if (!t) return;

  const title = prompt("New title?", t.title);
  if (title === null) return;

  const description = prompt("New description?", t.description || "") ?? "";
  const location = prompt("New location?", t.location || "") ?? "";

  await fetch(`${API_BASE}/trails/${trailId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, location }),
  });

  refresh();
}

async function delTrail(trailId) {
  if (!confirm("Delete this trail?")) return;

  await fetch(`${API_BASE}/trails/${trailId}`, { method: "DELETE" });
  refresh();
}

/* ---------- wire up ---------- */
const titleEl = document.getElementById("title");
const descriptionEl = document.getElementById("description");
const locationEl = document.getElementById("location");
const image = document.getElementById("image");

document.getElementById("createBtn").onclick = createTrail;
document.getElementById("refreshBtn").onclick = refresh;
document.getElementById("closeModal").onclick = closeTrailModal;
document.querySelector(".modal__backdrop").onclick = closeTrailModal;

refresh();
