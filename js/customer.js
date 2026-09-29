import { bootFirebase } from './firebase-app.js';
import { mount, qs, setError, setBusy, el } from './dom.js';
import { authErrorMessage } from './errors.js';
import {
  normalizePhone,
  last4,
  initialAuthPassword,
  toAuthEmail,
  phoneFromEmail,
  maskPhone,
  passwordsForSignIn,
  validateNewPassword,
} from './phone.js';

const CREDENTIAL_ERRORS = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-login-credentials',
]);

let auth;
let db;
let authMod;
let dbMod;
let generation = 0;
let flash = '';

function renderNotice(title, body, reload) {
  const root = mount('tpl-setup');
  qs(root, '#setup-title').textContent = title;
  qs(root, '#setup-body').textContent = body;
  if (reload) {
    const button = el('button', 'primary', '다시 시도');
    button.type = 'button';
    button.addEventListener('click', () => location.reload());
    qs(root, '.card').append(button);
  }
  return root;
}

function renderLogin() {
  const panel = mount('tpl-login');
  qs(panel, '#login-form').addEventListener('submit', onLoginSubmit);
  qs(panel, '#toggle-pw').addEventListener('click', () => {
    const input = qs(panel, '#password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    qs(panel, '#toggle-pw').textContent = show ? '숨기기' : '보기';
  });
  return panel;
}

function fillStamps(grid, stamps) {
  grid.replaceChildren();
  for (let i = 1; i <= 10; i += 1) {
    const item = el('li', i <= stamps ? 'stamp is-on' : 'stamp', i <= stamps ? '적' : String(i));
    item.setAttribute('aria-label', i <= stamps ? `${i}번 적립됨` : `${i}번 비어 있음`);
    grid.append(item);
  }
}

function renderHome(user, data, notice) {
  const panel = mount('tpl-home');
  const stamps = Math.max(0, Math.min(10, Number(data.stamps) || 0));
  const name = data.name || '손님';
  qs(panel, '#hello').textContent = `${name}님`;
  qs(panel, '#masked').textContent = maskPhone(data.phone || '');
  qs(panel, '#count').textContent = `${stamps} / 10`;
  fillStamps(qs(panel, '#grid'), stamps);
  qs(panel, '#remain').textContent = stamps >= 10
    ? '무료 이용 1회를 카운터에서 쓸 수 있습니다.'
    : `무료까지 ${10 - stamps}개 남았습니다.`;
  qs(panel, '#totals').textContent = `누적 적립 ${Number(data.totalEarned) || 0}회 · 무료 이용 ${Number(data.totalRedeemed) || 0}회`;
  const must = qs(panel, '#must');
  if (data.mustChangePassword) must.hidden = false;
  if (notice) qs(panel, '#pw-ok').textContent = notice;
  qs(panel, '#logout').addEventListener('click', () => {
    void authMod.signOut(auth);
  });
  qs(panel, '#pw-form').addEventListener('submit', (event) => {
    void onPasswordSubmit(event, user, data);
  });
}

async function reauthenticate(user, phone, typed) {
  const candidates = passwordsForSignIn(phone, typed);
  if (candidates.length === 0) {
    throw Object.assign(new Error('BAD_CURRENT'), { code: 'BAD_CURRENT' });
  }
  let lastError = null;
  for (const password of candidates) {
    try {
      const credential = authMod.EmailAuthProvider.credential(user.email, password);
      await authMod.reauthenticateWithCredential(user, credential);
      return;
    } catch (error) {
      lastError = error;
      if (!CREDENTIAL_ERRORS.has(error.code)) throw error;
    }
  }
  throw lastError;
}

async function onPasswordSubmit(event, user, data) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs(form, '#change-pw');
  const errorNode = qs(form, '#pw-error');
  const okNode = qs(form, '#pw-ok');
  setError(errorNode, '');
  okNode.textContent = '';
  const phone = data.phone;
  const currentTyped = qs(form, '#current-pw').value;
  const next = qs(form, '#next-pw').value;
  const confirm = qs(form, '#next-pw2').value;
  const invalid = validateNewPassword(phone, currentTyped, next, confirm);
  if (invalid) {
    setError(errorNode, invalid);
    return;
  }
  setBusy(button, true);
  try {
    await reauthenticate(user, phone, currentTyped);
    await authMod.updatePassword(user, next);
    try {
      await dbMod.updateDoc(dbMod.doc(db, 'users', user.uid), {
        mustChangePassword: false,
        updatedAt: dbMod.serverTimestamp(),
      });
    } catch (error) {
      setError(errorNode, `비밀번호는 바뀌었습니다. 안내를 끄지 못했습니다. ${authErrorMessage(error, 'customer')}`);
      return;
    }
    renderHome(user, { ...data, mustChangePassword: false }, '비밀번호를 바꿨습니다.');
  } catch (error) {
    if (!button.isConnected) return;
    if (error.code === 'BAD_CURRENT' || CREDENTIAL_ERRORS.has(error.code)) {
      setError(errorNode, '현재 비밀번호가 올바르지 않습니다.');
    } else {
      setError(errorNode, authErrorMessage(error, 'customer'));
    }
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

async function ensureProfile(user) {
  const phone = phoneFromEmail(user.email || '');
  if (!phone) return { status: 'not-customer' };
  const userRef = dbMod.doc(db, 'users', user.uid);
  const snap = await dbMod.getDoc(userRef);
  if (snap.exists()) return { status: 'ok', data: snap.data() };

  const pendingRef = dbMod.doc(db, 'pending', phone);
  const pendingSnap = await dbMod.getDoc(pendingRef);
  if (!pendingSnap.exists()) return { status: 'no-pending' };

  const pending = pendingSnap.data();
  const batch = dbMod.writeBatch(db);
  batch.set(userRef, {
    phone,
    name: pending.name,
    stamps: 0,
    totalEarned: 0,
    totalRedeemed: 0,
    mustChangePassword: true,
    role: 'customer',
    createdAt: dbMod.serverTimestamp(),
    updatedAt: dbMod.serverTimestamp(),
  });
  batch.set(dbMod.doc(dbMod.collection(db, 'logs')), {
    uid: user.uid,
    phone,
    type: 'register',
    byAdminUid: pending.createdBy,
    createdAt: dbMod.serverTimestamp(),
    stampsAfter: 0,
    consent: true,
  });
  batch.delete(pendingRef);
  await batch.commit();
  const created = await dbMod.getDoc(userRef);
  if (!created.exists()) {
    throw Object.assign(new Error('REGISTER_FAILED'), { code: 'REGISTER_FAILED' });
  }
  return { status: 'ok', data: created.data() };
}

async function settle(user, gen) {
  if (!user) {
    if (gen !== generation) return;
    const panel = renderLogin();
    if (flash) setError(qs(panel, '#form-error'), flash);
    flash = '';
    return;
  }
  try {
    const result = await ensureProfile(user);
    if (gen !== generation) return;
    if (result.status === 'ok') {
      flash = '';
      renderHome(user, result.data);
      return;
    }
    if (result.status === 'not-customer') {
      await leave(user, gen, '손님 화면입니다. 휴대폰 번호로 로그인해 주세요.', false);
      return;
    }
    await leave(user, gen, '카운터에서 먼저 등록해 주세요.', true);
  } catch (error) {
    if (gen !== generation) return;
    renderNotice('다시 시도해 주세요', authErrorMessage(error, 'customer'), true);
  }
}

async function leave(user, gen, message, deleteRecent) {
  flash = message;
  const created = Date.parse(user.metadata?.creationTime || '');
  const recent = deleteRecent && Number.isFinite(created) && Date.now() - created < 15 * 60 * 1000;
  try {
    if (recent) await authMod.deleteUser(user);
    else await authMod.signOut(auth);
  } catch {
    await authMod.signOut(auth).catch(() => {});
  }
  if (gen === generation && auth.currentUser) {
    const root = renderLogin();
    setError(qs(root, '#form-error'), flash);
    flash = '';
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs(form, '#login');
  const errorNode = qs(form, '#form-error');
  setError(errorNode, '');
  const phone = normalizePhone(qs(form, '#phone').value);
  const typed = qs(form, '#password').value;
  if (!phone) {
    setError(errorNode, '휴대폰 번호는 010-1234-5678 형식으로 입력해 주세요.');
    return;
  }
  const candidates = passwordsForSignIn(phone, typed);
  if (candidates.length === 0) {
    setError(errorNode, '첫 비밀번호는 번호 뒷자리 4자리입니다. 바꾼 뒤에는 6자 이상을 입력해 주세요.');
    return;
  }
  setBusy(button, true);
  try {
    let signedIn = false;
    let lastError = null;
    for (const password of candidates) {
      try {
        await authMod.signInWithEmailAndPassword(auth, toAuthEmail(phone), password);
        signedIn = true;
        break;
      } catch (error) {
        lastError = error;
        if (!CREDENTIAL_ERRORS.has(error.code)) throw error;
      }
    }
    if (signedIn) return;
    if (typed !== last4(phone)) {
      setError(errorNode, authErrorMessage(lastError, 'customer'));
      return;
    }
    if (!qs(form, '#consent').checked) {
      qs(form, '#privacy').open = true;
      setError(errorNode, '첫 입장은 개인정보 수집·이용 동의가 필요합니다.');
      qs(form, '#consent').focus();
      return;
    }
    await authMod.createUserWithEmailAndPassword(auth, toAuthEmail(phone), initialAuthPassword(phone));
  } catch (error) {
    if (!button.isConnected) return;
    if (error.code === 'auth/email-already-in-use') {
      setError(errorNode, '이미 등록된 번호입니다. 비밀번호가 기억나지 않으면 카운터에 문의해 주세요.');
      return;
    }
    setError(errorNode, authErrorMessage(error, 'customer'));
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

async function main() {
  try {
    const boot = await bootFirebase();
    auth = boot.auth;
    db = boot.db;
    authMod = boot.authMod;
    dbMod = boot.dbMod;
  } catch (error) {
    if (error.code === 'CDN_FAILED') {
      renderNotice(
        '연결을 확인하지 못했습니다',
        'Firebase 라이브러리를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 여세요.',
        true,
      );
      return;
    }
    renderNotice(
      '설정이 필요합니다',
      'Firebase 웹 설정이 아직 없습니다. README의 순서대로 js/firebase-config.js 를 만든 뒤 이 페이지를 다시 여세요.',
      false,
    );
    return;
  }
  authMod.onAuthStateChanged(auth, (user) => {
    const gen = ++generation;
    void settle(user, gen);
  });
}

void main();
