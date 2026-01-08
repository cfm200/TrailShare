const API_BASE = "https://trailshare-function-app-dfa7adbdhxfehjek.francecentral-01.azurewebsites.net/api";

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    "\"": "&quot;", "'": "&#039;"
  }[m]));
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

/* ---------- IMAGE UPLOAD ---------- */
async function uploadSelectedImage() {
  const input = document.getElementById("image");
  const file = input?.files?.[0];
  if (!file) return null;

  // 1) request upload URL
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

  // 2) upload file to blob
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type
    },
    body: file
  });

  if (!put.ok) throw new Error("Blob upload failed");

  return imagePath; // IMPORTANT
}

/* ---------- CRUD ---------- */
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
      body: JSON.stringify({
        title,
        location,
        description,
        imagePath
      })
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

    await refresh();
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

  trails.forEach(t => {
    const div = document.createElement("div");
    div.className = "trail";

    div.innerHTML = `
      <h3>${escapeHtml(t.title)}</h3>
      <div class="meta">📍 ${escapeHtml(t.location || "Unknown")} · Uploaded ${formatDate(t.createdAt)}</div>
      <p>${escapeHtml(t.description || "")}</p>

      ${t.imageUrl ? `<img src="${t.imageUrl}" alt="Trail image">` : ""}

      <div class="row">
        <button data-edit="${t.trailId}">Edit</button>
        <button data-del="${t.trailId}" class="danger">Delete</button>
      </div>
    `;

    list.appendChild(div);
  });

  list.querySelectorAll("[data-del]").forEach(b =>
    b.onclick = () => deleteTrail(b.dataset.del)
  );
}

async function deleteTrail(id) {
  if (!confirm("Delete this trail?")) return;
  await fetch(`${API_BASE}/trails/${encodeURIComponent(id)}`, { method: "DELETE" });
  refresh();
}

/* ---------- INIT ---------- */
document.getElementById("createBtn").onclick = createTrail;
document.getElementById("refreshBtn").onclick = refresh;
refresh();
