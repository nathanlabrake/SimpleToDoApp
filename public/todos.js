const MAX_ITEMS = 100;

const session = JSON.parse(localStorage.getItem("todo-session") || "null");
if (!session?.id) {
  window.location.href = "/login.html";
}

const welcomeText = document.getElementById("welcome");
const newListForm = document.getElementById("new-list-form");
const logoutBtn = document.getElementById("logout-btn");
const listError = document.getElementById("list-error");
const listsContainer = document.getElementById("lists-container");
const listTemplate = document.getElementById("todo-list-template");

welcomeText.textContent = `Signed in as ${session.email}`;

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("todo-session");
  window.location.href = "/login.html";
});

newListForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  listError.textContent = "";
  const title = document.getElementById("list-name").value.trim();

  if (!title) {
    listError.textContent = "List name is required.";
    return;
  }

  const response = await fetch(`/api/users/${session.id}/lists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  const payload = await response.json();
  if (!response.ok) {
    listError.textContent = payload.error || "Could not create list.";
    return;
  }

  newListForm.reset();
  await loadLists();
});

async function loadLists() {
  const response = await fetch(`/api/users/${session.id}/lists`);
  const lists = await response.json();

  listsContainer.innerHTML = "";
  if (!Array.isArray(lists) || lists.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subtext";
    empty.textContent = "You do not have any lists yet. Create one above.";
    listsContainer.appendChild(empty);
    return;
  }

  for (const list of lists) {
    const fragment = listTemplate.content.cloneNode(true);
    const titleElement = fragment.querySelector(".list-title");
    const metaElement = fragment.querySelector(".meta");
    const itemsElement = fragment.querySelector(".items");
    const noteElement = fragment.querySelector(".item-note");
    const itemForm = fragment.querySelector(".item-form");
    const input = fragment.querySelector(".item-input");

    titleElement.textContent = list.title;
    metaElement.textContent = `Created ${new Date(list.createdAt).toLocaleString()}`;

    for (const item of list.items) {
      const li = document.createElement("li");
      li.textContent = item.content;
      itemsElement.appendChild(li);
    }

    noteElement.textContent = `${list.items.length}/${MAX_ITEMS} items`;

    itemForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = input.value.trim();
      if (!content) return;

      const itemResponse = await fetch(`/api/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const itemPayload = await itemResponse.json();
      if (!itemResponse.ok) {
        noteElement.textContent = itemPayload.error || `Each list is limited to ${MAX_ITEMS} items.`;
        return;
      }

      await loadLists();
    });

    listsContainer.appendChild(fragment);
  }
}

loadLists();
