const API_BASE =
  "https://trailshare-function-app-dfa7adbdhxfehjek.francecentral-01.azurewebsites.net/api";

/* ---------------- helpers ---------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[m]));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/* ---------------- image upload ---------------- */
async function uploadSelectedImage() {
  const input = document.getElementById("image");
  const file = input?.files?.[0];
  if (!file) return null;

  const res = await fetch(`${API_BASE}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type
    })
  });

  if (!res.ok) throw new Error("Failed to get upload URL");

  const { uploadUrl, imagePath } = await res.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type
    },
    body: file
  });

  if (!put.ok) throw new Error("Blob upload failed");

  return imagePath;
}

/* ---------------- CRUD ---------------- */
async function createTrail() {
  const title = document.getElementById("title").value.trim();
  const location = document.getElementById("location").value.trim();
  const description = document.getElementById("description").value.trim();
  const msg = document.getElementById("msg");

  try {
    let imagePath = null;
    if (document.getElementById("image").files.length) {
      imagePath = await uploadSelectedImage();
    }

    const res = await fetch(`${API_BASE}/trails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, location, description, imagePath })
    });

    if (!res.ok) {
      const err = await res.json();
      msg.textContent = err.error || "Create failed";
      return;
    }

    msg.textContent = "Created!";
    document.getElementById("title").value = "";
    document.getElementById("location").value = "";
    document.getElementById("description").value = "";
    document.getElementById("image").value = "";

    refresh();
  } catch (e) {
    msg.textContent = e.message;
  }
}

async function refresh() {
  const res = await fetch(`${API_BASE}/trails`);
  const trails = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  if (!trails.length) {
    list.innerHTML = `<div class="empty">No trails yet</div>`;
    return;
  }

  trails.forEach(trail => {
    const card = document.createElement("div");
    card.className = "trail";

    const aiCaption = trail.aiCaption
      ? `<p class="trail__ai">🤖 ${escapeHtml(trail.aiCaption)}</p>`
      : "";

    const aiTags = Array.isArray(trail.aiTags) && trail.aiTags.length
      ? `
        <div class="trail__tags">
          ${trail.aiTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      `
      : "";

    card.innerHTML = `
      <h3 class="trail__title">${escapeHtml(trail.title)}</h3>

      <div class="trail__meta">
        📍 ${escapeHtml(trail.location || "Unknown")}
        · Uploaded ${formatDate(trail.createdAt)}
      </div>

      ${
        trail.imagePath
          ? `
            <div class="trail__img">
              <img
                src="https://trailsharewebstorage.blob.core.windows.net/media/${trail.imagePath}"
                alt="Trail image"
              >
            </div>
          `
          : ""
      }

      ${aiCaption}
      ${aiTags}

      <p class="trail__desc">${escapeHtml(trail.description || "")}</p>

      <div class="trail__actions">
        <button class="btn" data-edit="${trail.trailId}">Edit</button>
        <button class="btn btn--danger" data-del="${trail.trailId}">Delete</button>
      </div>
    `;

    card.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      openTrailModal(trail);
    });

    list.appendChild(card);
  });

  list.querySelectorAll("[data-del]").forEach(b =>
    b.onclick = () => deleteTrail(b.dataset.del)
  );

  list.querySelectorAll("[data-edit]").forEach(b =>
    b.onclick = () => editTrail(b.dataset.edit)
  );
}

async function editTrail(trailId) {
  const title = prompt("New title?");
  if (title === null) return;

  const description = prompt("New description?") ?? "";

  await fetch(`${API_BASE}/trails/${encodeURIComponent(trailId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description })
  });

  refresh();
}

async function deleteTrail(trailId) {
  if (!confirm("Delete this trail?")) return;
  await fetch(`${API_BASE}/trails/${encodeURIComponent(trailId)}`, {
    method: "DELETE"
  });
  refresh();
}

/* ---------------- MODAL ---------------- */
function openTrailModal(trail) {
  const modal = document.getElementById("trailModal");
  const title = document.getElementById("modalTitle");
  const meta = document.getElementById("modalMeta");
  const imageWrap = document.getElementById("modalImageWrap");
  const image = document.getElementById("modalImage");
  const desc = document.getElementById("modalDesc");

  title.textContent = trail.title;
  meta.textContent =
    `📍 ${trail.location || "Unknown"} · Uploaded ${formatDate(trail.createdAt)}`;

  if (trail.imagePath) {
    image.src =
      `https://trailsharewebstorage.blob.core.windows.net/media/${trail.imagePath}`;
    imageWrap.classList.remove("hidden");
  } else {
    imageWrap.classList.add("hidden");
    image.src = "";
  }

  desc.textContent =
    (trail.aiCaption ? `🤖 ${trail.aiCaption}\n\n` : "") +
    (trail.description || "");

  modal.classList.remove("hidden");

  document.getElementById("modalEdit").onclick =
    () => editTrail(trail.trailId);

  document.getElementById("modalDelete").onclick =
    () => deleteTrail(trail.trailId);
}

/* ---------------- init ---------------- */
document.getElementById("createBtn").onclick = createTrail;
document.getElementById("refreshBtn").onclick = refresh;

document.getElementById("closeModal").onclick =
  () => document.getElementById("trailModal").classList.add("hidden");

document.querySelector(".modal__backdrop").onclick =
  () => document.getElementById("trailModal").classList.add("hidden");

refresh();
