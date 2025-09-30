import admin from "firebase-admin";

let firestoreInstance = null;

function decodePrivateKey() {
  const base64 = process.env.FIREBASE_PRIVATE_KEY_B64;
  if (base64) {
    return Buffer.from(base64, "base64").toString("utf-8");
  }
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (raw) {
    return raw.replace(/\\n/g, "\n");
  }
  return null;
}

function getServiceAccountConfig() {
  const privateKey = decodePrivateKey();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!privateKey || !clientEmail) {
    return null;
  }
  return {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: clientEmail,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };
}

function initializeAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = getServiceAccountConfig();
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }

  return admin.app();
}

export function getFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  const app = initializeAdminApp();
  firestoreInstance = app.firestore();
  return firestoreInstance;
}

export function getAdminApp() {
  return initializeAdminApp();
}
