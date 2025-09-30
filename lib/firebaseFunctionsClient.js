const DEFAULT_REGION = process.env.FIREBASE_FUNCTIONS_REGION || "asia-northeast1";

function buildBaseUrl() {
  if (process.env.FIREBASE_FUNCTIONS_BASE_URL) {
    return process.env.FIREBASE_FUNCTIONS_BASE_URL.replace(/\/$/, "");
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  return `https://${DEFAULT_REGION}-${projectId}.cloudfunctions.net`;
}

const baseUrl = buildBaseUrl();

export function isFirebaseFunctionsEnabled() {
  return Boolean(baseUrl);
}

export async function callFirebaseFunction({ name, payload, method = "POST", headers = {} }) {
  if (!baseUrl) {
    throw new Error(
      "Firebase Functions base URL is not configured. Set FIREBASE_FUNCTIONS_BASE_URL or FIREBASE_PROJECT_ID."
    );
  }
  const url = `${baseUrl}/${name}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
  });

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { response, data };
}
