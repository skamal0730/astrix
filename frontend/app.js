const output = document.getElementById("output");
const form = document.getElementById("intent-form");
const createTopicBtn = document.getElementById("create-topic");

function print(obj) {
  output.textContent = JSON.stringify(obj, null, 2);
}

createTopicBtn.addEventListener("click", async () => {
  createTopicBtn.disabled = true;
  createTopicBtn.textContent = "Creating...";
  try {
    const res = await fetch("/api/hcs/create-topic", { method: "POST" });
    const data = await res.json();
    print(data);
  } catch (err) {
    print({ error: err.message || String(err) });
  } finally {
    createTopicBtn.disabled = false;
    createTopicBtn.textContent = "Create New HCS Topic";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Broadcasting...";
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  try {
    const res = await fetch("/api/intents/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    print(data);
  } catch (err) {
    print({ error: err.message || String(err) });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Broadcast Intent to HCS";
  }
});
