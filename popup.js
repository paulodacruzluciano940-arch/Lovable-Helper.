const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "lovableHelperPrompts";
const CREDITS_KEY = "lovableHelperCredits";
let prompts = [];

async function loadData() {
  const data = await chrome.storage.local.get([STORAGE_KEY, CREDITS_KEY]);
  prompts = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  if (Number.isInteger(data[CREDITS_KEY])) $("credits").value = data[CREDITS_KEY];
  renderPrompts();
}

async function savePrompts() {
  await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
  renderPrompts();
}

function renderPrompts() {
  const list = $("promptList");
  const query = $("search").value.trim().toLowerCase();
  const filtered = prompts.filter((p) => (p.title + " " + p.text).toLowerCase().includes(query));
  list.replaceChildren();
  $("promptCount").textContent = String(prompts.length);
  $("emptyState").hidden = filtered.length > 0;
  if (prompts.length > 0 && filtered.length === 0) {
    $("emptyState").hidden = false;
    $("emptyState").textContent = "Nenhum prompt corresponde à pesquisa.";
  } else {
    $("emptyState").textContent = "Ainda não guardaste prompts.";
  }

  filtered.forEach((prompt) => {
    const card = document.createElement("article");
    card.className = "prompt-card";
    const title = document.createElement("h3");
    title.textContent = prompt.title || "Prompt sem título";
    const preview = document.createElement("p");
    preview.textContent = prompt.text;
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const copy = makeButton("Copiar", "secondary", async () => {
      try {
        await navigator.clipboard.writeText(prompt.text);
        $("formStatus").textContent = "Prompt copiado para a área de transferência.";
      } catch {
        $("formStatus").textContent = "Não foi possível copiar automaticamente. Abre o prompt para o copiar manualmente.";
      }
    });
    const edit = makeButton("Editar", "secondary", () => {
      $("promptTitle").value = prompt.title;
      $("promptText").value = prompt.text;
      $("savePrompt").dataset.editId = prompt.id;
      $("savePrompt").textContent = "Guardar alterações";
      $("formStatus").textContent = "A editar: " + prompt.title;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const remove = makeButton("Apagar", "secondary", async () => {
      if (!confirm("Apagar este prompt?")) return;
      prompts = prompts.filter((p) => p.id !== prompt.id);
      await savePrompts();
    });
    actions.append(copy, edit, remove);
    card.append(title, preview, actions);
    list.append(card);
  });
}

function makeButton(label, style, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button " + style;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

$("saveCredits").addEventListener("click", async () => {
  const value = Number($("credits").value);
  if (!Number.isInteger(value) || value < 0) {
    $("creditStatus").textContent = "Introduz um número inteiro igual ou superior a zero.";
    return;
  }
  await chrome.storage.local.set({ [CREDITS_KEY]: value });
  $("creditStatus").textContent = "Registo manual guardado: " + value + " crédito(s).";
});

$("savePrompt").addEventListener("click", async () => {
  const title = $("promptTitle").value.trim();
  const text = $("promptText").value.trim();
  if (!text) {
    $("formStatus").textContent = "Escreve o conteúdo do prompt antes de guardar.";
    return;
  }
  const editId = $("savePrompt").dataset.editId;
  if (editId) {
    prompts = prompts.map((p) => p.id === editId ? { ...p, title: title || "Prompt sem título", text, updatedAt: new Date().toISOString() } : p);
  } else {
    prompts.unshift({ id: crypto.randomUUID(), title: title || "Prompt sem título", text, createdAt: new Date().toISOString() });
  }
  await savePrompts();
  resetForm();
  $("formStatus").textContent = editId ? "Prompt actualizado." : "Prompt guardado.";
});

function resetForm() {
  $("promptTitle").value = "";
  $("promptText").value = "";
  delete $("savePrompt").dataset.editId;
  $("savePrompt").textContent = "Guardar prompt";
}

$("clearForm").addEventListener("click", () => {
  resetForm();
  $("formStatus").textContent = "";
});

$("search").addEventListener("input", renderPrompts);

$("exportData").addEventListener("click", async () => {
  const data = await chrome.storage.local.get([STORAGE_KEY, CREDITS_KEY]);
  const blob = new Blob([JSON.stringify({ version: 1, prompts: data[STORAGE_KEY] || [], credits: data[CREDITS_KEY] ?? null }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lovable-helper-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  $("backupStatus").textContent = "Cópia de segurança exportada.";
});

$("importData").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.prompts) || !data.prompts.every((p) => p && typeof p.text === "string")) {
      throw new Error("Formato inválido");
    }
    const normalized = data.prompts.map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      title: typeof p.title === "string" ? p.title : "Prompt sem título",
      text: p.text,
      createdAt: p.createdAt || new Date().toISOString()
    }));
    if (!confirm("Importar " + normalized.length + " prompt(s)? Esta acção substitui a lista actual.")) return;
    prompts = normalized;
    await savePrompts();
    if (Number.isInteger(data.credits) && data.credits >= 0) {
      $("credits").value = data.credits;
      await chrome.storage.local.set({ [CREDITS_KEY]: data.credits });
    }
    $("backupStatus").textContent = "Cópia importada com sucesso.";
  } catch {
    $("backupStatus").textContent = "Não foi possível importar. Confirma se escolheste uma cópia JSON válida.";
  } finally {
    event.target.value = "";
  }
});

loadData().catch(() => {
  $("formStatus").textContent = "Não foi possível carregar os dados locais.";
});
