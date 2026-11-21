/* Use the deployed Cloudflare Worker URL. Never put an API key or secret here. */
const WORKER_URL = "https://loreal-routine-project-9.richardtienle.workers.dev";

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearSelectedButton = document.getElementById("clearSelected");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const rtlToggle = document.getElementById("rtlToggle");
const webSearchToggle = document.getElementById("webSearchToggle");

const SELECTED_STORAGE_KEY = "loreal-selected-product-ids";
const DIRECTION_STORAGE_KEY = "loreal-page-direction";
const WEB_SEARCH_STORAGE_KEY = "loreal-web-search-enabled";
let allProducts = [];
let selectedProductIds = loadSelectedProductIds();
let conversationHistory = [];
let routineProductIdsSignature = "";
let requestInProgress = false;

// Live search is enabled by default, but remember if the user turns it off.
try {
  webSearchToggle.checked =
    localStorage.getItem(WEB_SEARCH_STORAGE_KEY) !== "false";
} catch (error) {
  webSearchToggle.checked = true;
}

webSearchToggle.addEventListener("change", () => {
  try {
    localStorage.setItem(
      WEB_SEARCH_STORAGE_KEY,
      String(webSearchToggle.checked),
    );
  } catch (error) {
    // The search toggle still works when storage is unavailable.
  }
});

/* Load the saved product IDs and keep only IDs that exist in products.json. */
function loadSelectedProductIds() {
  try {
    const savedIds =
      JSON.parse(localStorage.getItem(SELECTED_STORAGE_KEY)) || [];
    if (!Array.isArray(savedIds)) {
      return [];
    }
    return [
      ...new Set(
        savedIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  } catch (error) {
    return [];
  }
}

/* Save selected IDs so selections return after a page refresh. */
function saveSelectedProductIds() {
  try {
    localStorage.setItem(
      SELECTED_STORAGE_KEY,
      JSON.stringify(selectedProductIds),
    );
  } catch (error) {
    addChatMessage(
      "error",
      "Your selection changed, but it could not be saved in this browser.",
    );
  }
}

/* Escape text before placing it in HTML. */
function escapeHtml(text) {
  const element = document.createElement("div");
  element.textContent = text == null ? "" : String(text);
  return element.innerHTML;
}

/* Return only complete, currently selected product records for the Worker. */
function getSelectedProducts() {
  return allProducts
    .filter((product) => selectedProductIds.includes(product.id))
    .map((product) => ({
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      description: product.description,
    }));
}

/* Fetch the local product catalog once. */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    if (!response.ok) {
      throw new Error("Could not load the product catalog.");
    }
    const data = await response.json();
    allProducts = Array.isArray(data.products) ? data.products : [];
    const validIds = new Set(allProducts.map((product) => product.id));
    const validatedIds = selectedProductIds.filter((id) => validIds.has(id));
    if (validatedIds.length !== selectedProductIds.length) {
      selectedProductIds = validatedIds;
      saveSelectedProductIds();
    }
    filterProducts();
    renderSelectedProducts();
  } catch (error) {
    productsContainer.innerHTML =
      '<div class="empty-message">The product catalog could not be loaded.</div>';
  }
}

/* Combine category filtering and live keyword search. */
function filterProducts() {
  const category = categoryFilter.value;
  const keyword = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const matchesKeyword = !keyword || searchableText.includes(keyword);

    return matchesCategory && matchesKeyword;
  });

  displayProducts(filteredProducts);
}

/* Display product cards with accessible selection controls and descriptions. */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML =
      '<div class="empty-message">No products match your search.</div>';
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProductIds.includes(product.id);
      const fallbackInitial = escapeHtml(
        (product.brand || product.name || "L'Oréal")
          .trim()
          .charAt(0)
          .toUpperCase(),
      );
      return `
        <article class="product-card${isSelected ? " selected" : ""}" data-product-id="${product.id}">
          <button
            type="button"
            class="product-select"
            data-product-id="${product.id}"
            data-fallback="${fallbackInitial}"
            aria-pressed="${isSelected}"
            aria-label="${isSelected ? "Remove" : "Select"} ${escapeHtml(product.brand)} ${escapeHtml(product.name)}"
          >
            <img src="${escapeHtml(product.image)}" alt="" data-fallback="${fallbackInitial}" />
            <div class="product-info">
              <p class="brand">${escapeHtml(product.brand)}</p>
              <h3>${escapeHtml(product.name)}</h3>
            </div>
            <span class="selection-mark" aria-hidden="true">
              <i class="fa-solid fa-check"></i>
            </span>
          </button>
          <details class="product-details">
            <summary>View full description</summary>
            <p>${escapeHtml(product.description)}</p>
          </details>
        </article>
      `;
    })
    .join("");

  // Replace failed remote images with an elegant letter mark; no fake image is invented.
  productsContainer.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      const card = image.closest(".product-card");
      if (card) {
        card.classList.add("image-fallback");
      }
    });
  });
}

/* Toggle a product on or off from the selected list. */
function toggleProduct(productId) {
  if (selectedProductIds.includes(productId)) {
    selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  } else {
    selectedProductIds = [...selectedProductIds, productId];
  }

  saveSelectedProductIds();
  filterProducts();
  renderSelectedProducts();
  markSelectionChangeIfRoutineExists();
}

/* Render selected products and remove buttons. */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.includes(product.id),
  );

  generateRoutineButton.disabled = selectedProducts.length === 0;
  clearSelectedButton.hidden = selectedProducts.length === 0;

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="empty-selection">Choose products to build your routine.</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <span class="selected-chip">
          ${escapeHtml(product.brand)} — ${escapeHtml(product.name)}
          <button
            type="button"
            class="remove-product"
            data-remove-id="${product.id}"
            aria-label="Remove ${escapeHtml(product.name)}"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </span>
      `,
    )
    .join("");
}

/* A product card sends the product ID when it is clicked. */
productsContainer.addEventListener("click", (event) => {
  const selectButton = event.target.closest(".product-select");
  if (selectButton) {
    toggleProduct(Number(selectButton.dataset.productId));
    return;
  }

  const card = event.target.closest(".product-card");
  if (card && !event.target.closest(".product-details")) {
    toggleProduct(Number(card.dataset.productId));
  }
});

/* Remove an individual selected product. */
selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-product");
  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.removeId);
  selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  saveSelectedProductIds();
  filterProducts();
  renderSelectedProducts();
  markSelectionChangeIfRoutineExists();
});

clearSelectedButton.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelectedProductIds();
  filterProducts();
  renderSelectedProducts();
  markSelectionChangeIfRoutineExists();
});

categoryFilter.addEventListener("change", filterProducts);
productSearch.addEventListener("input", filterProducts);

/* Apply and label the selected reading direction consistently. */
function applyDirection(direction) {
  const isRtl = direction === "rtl";
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = isRtl ? "ar" : "en";
  rtlToggle.setAttribute("aria-pressed", String(isRtl));
  rtlToggle.setAttribute(
    "aria-label",
    isRtl ? "Switch to left-to-right layout" : "Switch to right-to-left layout",
  );
}

/* Toggle page direction for right-to-left languages. */
rtlToggle.addEventListener("click", () => {
  const isRtl = document.documentElement.dir === "rtl";
  applyDirection(isRtl ? "ltr" : "rtl");
  try {
    localStorage.setItem(DIRECTION_STORAGE_KEY, isRtl ? "ltr" : "rtl");
  } catch (error) {
    // The layout still works when storage is unavailable.
  }
});

/* Add a visible message to the chat window. */
function addChatMessage(role, text, citations = []) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.textContent = text;

  if (role === "assistant" && citations.length > 0) {
    const citationBlock = document.createElement("div");
    citationBlock.className = "citations";
    citationBlock.innerHTML = "<strong>Sources:</strong><br>";

    citations.forEach((citation) => {
      if (!citation.url) {
        return;
      }
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title || citation.url;
      citationBlock.appendChild(link);
      citationBlock.appendChild(document.createElement("br"));
    });

    message.appendChild(citationBlock);
  }

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

/* Collect citations returned by a Worker that supports web search. */
function getCitations(data) {
  const citations = [];
  const candidates = [
    ...(Array.isArray(data.citations) ? data.citations : []),
    ...(Array.isArray(data.sources) ? data.sources : []),
    ...(Array.isArray(data.annotations) ? data.annotations : []),
  ];

  const message =
    data.choices && data.choices[0] ? data.choices[0].message : null;

  if (message && Array.isArray(message.annotations)) {
    message.annotations.forEach((annotation) => {
      if (annotation.type === "url_citation" && annotation.url) {
        candidates.push({
          url: annotation.url,
          title: annotation.title,
        });
      }
    });
  }

  candidates.forEach((candidate) => {
    if (!candidate || typeof candidate.url !== "string") {
      return;
    }
    try {
      const parsedUrl = new URL(candidate.url);
      if (
        (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
        !citations.some((citation) => citation.url === parsedUrl.href)
      ) {
        citations.push({
          url: parsedUrl.href,
          title:
            typeof candidate.title === "string"
              ? candidate.title
              : parsedUrl.href,
        });
      }
    } catch (error) {
      // Ignore malformed citation URLs.
    }
  });

  return citations;
}

/* Send the full messages array to the configured Cloudflare Worker. */
async function sendToWorker() {
  if (!WORKER_URL) {
    throw new Error(
      "The Cloudflare Worker URL is not configured. Add the class-hosted Worker URL to WORKER_URL in script.js.",
    );
  }

  let response;
  let data;
  try {
    response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: conversationHistory,
        selected_products: getSelectedProducts(),
        web_search: webSearchToggle.checked,
      }),
    });
    data = await response.json();
  } catch (error) {
    throw new Error(
      "Could not reach the AI service. Check your connection and the Worker URL.",
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "The AI service returned an error.");
  }

  const choiceContent =
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  const reply =
    (typeof choiceContent === "string" &&
      choiceContent.trim() &&
      choiceContent) ||
    (typeof data.response === "string" &&
      data.response.trim() &&
      data.response) ||
    (typeof data.output === "string" && data.output.trim() && data.output) ||
    (typeof data.output_text === "string" &&
      data.output_text.trim() &&
      data.output_text);

  if (!reply) {
    throw new Error(
      "The AI service returned an unexpected response. Please try again.",
    );
  }

  const citations = getCitations(data);
  return { reply, citations };
}

/* Compare selections so follow-up chats can warn about a changed routine context. */
function getSelectedProductSignature() {
  return [...selectedProductIds].sort((a, b) => a - b).join(",");
}

function markSelectionChangeIfRoutineExists() {
  if (
    routineProductIdsSignature &&
    routineProductIdsSignature !== getSelectedProductSignature()
  ) {
    addChatMessage(
      "notice",
      "Your selected products changed. Generate a new routine before relying on the previous routine.",
    );
  }
}

/* Generate a routine from only the products the user selected. */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProductIds.length === 0 || requestInProgress) {
    return;
  }

  // Start a fresh conversation. The Worker builds the private system instruction
  // from selected_products, so conversationHistory contains only chat messages.
  conversationHistory = [];
  const prompt =
    "Create a personalized step-by-step routine using only the selected products. " +
    "Organize the steps in the best order, explain when to use each product, " +
    "and keep the answer concise.";

  conversationHistory.push({ role: "user", content: prompt });
  addChatMessage("user", "Please generate my selected-product routine.");
  requestInProgress = true;
  sendButton.disabled = true;
  generateRoutineButton.disabled = true;
  generateRoutineButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating routine…';
  const loadingMessage = addChatMessage(
    "loading",
    "Generating your personalized routine…",
  );

  try {
    const result = await sendToWorker();
    loadingMessage.remove();
    conversationHistory.push({
      role: "assistant",
      content: result.reply,
    });
    routineProductIdsSignature = getSelectedProductSignature();
    addChatMessage("assistant", result.reply, result.citations);
  } catch (error) {
    loadingMessage.remove();
    addChatMessage("error", error.message);
  } finally {
    requestInProgress = false;
    sendButton.disabled = false;
    generateRoutineButton.disabled = selectedProductIds.length === 0;
    generateRoutineButton.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Generate Routine';
  }
});

/* Send follow-up questions with the complete conversation history. */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const messageText = userInput.value.trim();

  if (!messageText || requestInProgress) {
    return;
  }

  conversationHistory.push({ role: "user", content: messageText });
  addChatMessage("user", messageText);
  userInput.value = "";
  requestInProgress = true;
  sendButton.disabled = true;
  sendButton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span class="visually-hidden">Sending</span>';
  const loadingMessage = addChatMessage("loading", "Thinking…");

  try {
    const result = await sendToWorker();
    loadingMessage.remove();
    conversationHistory.push({
      role: "assistant",
      content: result.reply,
    });
    addChatMessage("assistant", result.reply, result.citations);
  } catch (error) {
    loadingMessage.remove();
    addChatMessage("error", error.message);
  } finally {
    requestInProgress = false;
    sendButton.disabled = false;
    sendButton.innerHTML =
      '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span class="visually-hidden">Send</span>';
  }
});

try {
  const savedDirection = localStorage.getItem(DIRECTION_STORAGE_KEY);
  applyDirection(savedDirection === "rtl" ? "rtl" : "ltr");
} catch (error) {
  applyDirection("ltr");
}

loadProducts();
