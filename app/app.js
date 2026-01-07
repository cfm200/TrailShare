const API_BASE = "https://trailshare-function-app-dfa7adbdhxfehjek.francecentral-01.azurewebsites.net/api";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m]));
}

async function refresh() {
  const res = await fetch(`${API_BASE}/trails`);
  const data = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  data.forEach(t => {
    const div = document.createElement("div");
    div.className = "trail";
    div.innerHTML = `
      <div><b>${escapeHtml(t.title)}</b></div>
      <div class="small">trailId: ${t.trailId} | updated: ${t.updatedAt}</div>
      <div>${escapeHtml(t.description || "")}</div>
      <div class="row">
        <button data-edit="${t.trailId}">Edit</button>
        <button data-del="${t.trailId}">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => delTrail(btn.dataset.del));
  });
  list.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => editTrail(btn.dataset.edit));
  });
}

async function createTrail() {
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const msg = document.getElementById("msg");

  const res = await fetch(`${API_BASE}/trails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg.textContent = `Error: ${err.error || res.status}`;
    return;
  }

  msg.textContent = "Created!";
  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  await refresh();
}

async function editTrail(trailId) {
  const newTitle = prompt("New title?");
  if (newTitle === null) return;
  const newDesc = prompt("New description?") ?? "";

  const res = await fetch(`${API_BASE}/trails/${encodeURIComponent(trailId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: newTitle, description: newDesc })
  });

  if (!res.ok) alert("Update failed");
  await refresh();
}

async function delTrail(trailId) {
  if (!confirm(`Delete ${trailId}?`)) return;
  const res = await fetch(`${API_BASE}/trails/${encodeURIComponent(trailId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) alert("Delete failed");
  await refresh();
}

document.getElementById("createBtn").addEventListener("click", createTrail);
document.getElementById("refreshBtn").addEventListener("click", refresh);
refresh();

