const API_BASE =
  "https://trailshare-function-app-dfa7adbdhxfehjek.francecentral-01.azurewebsites.net/api";

/* ------------------ helpers ------------------ */

function $(id) {
  return document.getElementById(id);
}

function setMsg(text = "", isError = false) {
  const el = $("msg");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#ff6b6b" : "#7cffb2";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

/* ------------------ image upload ------------------ */

async function uploadSelectedImage() {
  const input = $("image");
  const file = input?.files?.[0];
  if (!file) return null;

  // ask backend for SAS URL
  const sasRes = await fetch(`${API_BASE}/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type
    })
  });

  if (!sasRes.ok) throw new Error("Failed to get upload URL");

  const { uploadUrl, imageUrl } = await sasRes.json();

  // upload directly to blob
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type
    },
    body: file
  });

  if (!putRes.ok) throw new Error("Image upload failed");

  return imageUrl;
}

/* ------------------ CRUD ------------------ */

async function createTrail() {
  setMsg("");

  const title = $("title").value.trim();
  const description = $("description").value.trim();

  if (!title) {
    setMsg("Title is required", true);
    return;
  }

  try {
    const imageUrl = await uploadSelectedImage();

    const res = await fetch(`${API_BASE}/trails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        imageUrl
      })
    });

    if (!res.ok) {
      setMsg("Server error", true);
      return;
    }

    $("title").value = "";
    $("description").value = "";
    $("image").value = "";

    setMsg("Trail created!");
    await refresh();
  } catch (err) {
    console.error(err);
    setMsg("Failed to create trail", true);
  }
}

async function editTrail(trailId) {
  const newTitle = prompt("New title?");
  if (newTitle === null) return;

  const newDesc = prompt("New description?") ?? "";

  const res = await fetch(
    `${API_BASE}/trails/${encodeURIComponent(trailId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDesc
      })
    }
  );

  if (!res.ok) {
    alert("Update failed");
    return;
  }

  await refresh();
}

async function delTrail(trailId) {
  if (!confirm(`Delete ${trailId}?`)) return;

  const res = await fetch(
    `${API_BASE}/trails/${encodeURIComponent(trailId)}`,
    { method: "DELETE" }
  );

  if (!res.ok && res.status !== 204) {
    alert("Delete failed");
    return;
  }

  await refresh();
}

/* ------------------ rendering ------------------ */

function renderTrailCard(t) {
  const card = document.createElement("div");
  card.className = "card trail-card";

  const title = document.createElement("h3");
  title.className = "trail-title";
  title.textContent = t.title || "(untitled)";

  const meta = document.createElement("p");
  meta.className = "trail-meta";
  meta.textContent = `trailId: ${t.trailId} • updated: ${t.updatedAt || ""}`;

  const desc = document.createElement("p");
  desc.className = "trail-desc";
  desc.textContent = t.description || "";

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(desc);

  if (t.imageUrl) {
    const img = document.createElement("img");
    img.className = "trail-img";
    img.src = t.imageUrl;
    img.alt = t.title || "Trail image";
    card.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "row";
  actions.innerHTML = `
    <button data-edit="${t.trailId}">Edit</button>
    <button data-del="${t.trailId}">Delete</button>
  `;
  card.appendChild(actions);

  return card;
}

async function refresh() {
  setMsg("");

  const res = await fetch(`${API_BASE}/trails`);
  if (!res.ok) {
    setMsg("Failed to load trails", true);
    return;
  }

  const data = await res.json().catch(() => []);
  const list = $("list");
  list.innerHTML = "";

  if (data.length === 0) {
    list.innerHTML = "<p style='opacity:.7'>No trails yet.</p>";
    return;
  }

  data.forEach(t => list.appendChild(renderTrailCard(t)));

  list.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => delTrail(btn.dataset.del))
  );

  list.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => editTrail(btn.dataset.edit))
  );
}



/* ------------------ events ------------------ */

$("createBtn")?.addEventListener("click", createTrail);
$("refreshBtn")?.addEventListener("click", refresh);

refresh();
