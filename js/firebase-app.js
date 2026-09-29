const CDN = 'https://www.gstatic.com/firebasejs/11.10.0';

function usable(config) {
  if (!config || typeof config !== 'object') return false;
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    const value = config[key];
    if (typeof value !== 'string' || value.length < 8 || value.includes('YOUR_')) return false;
  }
  return true;
}

export async function bootFirebase(appName) {
  let loaded;
  try {
    loaded = await import('./firebase-config.js');
  } catch {
    const error = new Error('CONFIG_MISSING');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  if (!usable(loaded.firebaseConfig)) {
    const error = new Error('CONFIG_PLACEHOLDER');
    error.code = 'CONFIG_PLACEHOLDER';
    throw error;
  }
  let initializeApp;
  let authMod;
  let dbMod;
  try {
    [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
  } catch {
    const error = new Error('CDN_FAILED');
    error.code = 'CDN_FAILED';
    throw error;
  }
  const app = appName
    ? initializeApp(loaded.firebaseConfig, appName)
    : initializeApp(loaded.firebaseConfig);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'ko';
  const db = dbMod.getFirestore(app);
  return { auth, db, authMod, dbMod };
}
