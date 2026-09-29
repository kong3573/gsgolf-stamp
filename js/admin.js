import { bootFirebase } from './firebase-app.js';
import { mount, qs, setError, setBusy, el, formatWhen } from './dom.js';
import { authErrorMessage } from './errors.js';
import { normalizePhone, last4, cleanName, formatPhone } from './phone.js';

const LOG_LABEL = {
  register: '등록',
  earn: '적립',
  redeem: '무료 이용',
  deduct: '1회 차감',
};

let auth;
let db;
let authMod;
let dbMod;
let generation = 0;
let flash = '';
let panel = null;

function renderNotice(title, body) {
  const root = mount('tpl-setup');
  qs(root, '#setup-title').textContent = title;
  qs(root, '#setup-body').textContent = body;
  const button = el('button', 'primary', '다시 시도');
  button.type = 'button';
  button.addEventListener('click', () => location.reload());
  qs(root, '.card').append(button);
}

function renderLogin() {
  panel = mount('tpl-login');
  qs(panel, '#login-form').addEventListener('submit', onLoginSubmit);
  if (flash) setError(qs(panel, '#form-error'), flash);
  flash = '';
  return panel;
}

function renderApp(user) {
  panel = mount('tpl-app');
  qs(panel, '#who').textContent = user.email || '직원';
  qs(panel, '#logout').addEventListener('click', () => {
    void authMod.signOut(auth);
  });
  qs(panel, '#reg-form').addEventListener('submit', onRegister);
  qs(panel, '#find-form').addEventListener('submit', onLookup);
  const customerUrl = new URL('./', location.href).href;
  const adminUrl = new URL('admin.html', location.href).href;
  qs(panel, '#customer-url').textContent = customerUrl;
  qs(panel, '#admin-url').textContent = adminUrl;
  qs(panel, '#copy-customer').addEventListener('click', () => copyUrl(customerUrl, qs(panel, '#copy-customer')));
  qs(panel, '#copy-admin').addEventListener('click', () => copyUrl(adminUrl, qs(panel, '#copy-admin')));
  void refreshLogs();
}

async function copyUrl(url, button) {
  const label = button.dataset.label || button.textContent;
  button.dataset.label = label;
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = '복사했습니다';
  } catch {
    button.textContent = '주소를 직접 선택해 주세요';
  }
  setTimeout(() => {
    if (button.isConnected) button.textContent = label;
  }, 1600);
}

async function refreshLogs() {
  const list = document.getElementById('log-list');
  if (!list) return;
  try {
    const snap = await dbMod.getDocs(dbMod.query(
      dbMod.collection(db, 'logs'),
      dbMod.orderBy('createdAt', 'desc'),
      dbMod.limit(20),
    ));
    list.replaceChildren();
    if (snap.empty) {
      list.append(el('li', 'muted', '아직 기록이 없습니다.'));
      return;
    }
    snap.forEach((item) => {
      const data = item.data();
      const row = el('li', 'log-item');
      row.append(
        el('span', 'log-type', LOG_LABEL[data.type] || data.type || '기록'),
        el('span', 'log-phone', formatPhone(data.phone || '')),
        el('span', 'log-meta', `${formatWhen(data.createdAt)} · 잔여 ${data.stampsAfter ?? '-'}개`),
      );
      list.append(row);
    });
  } catch (error) {
    list.replaceChildren(el('li', 'muted', authErrorMessage(error, 'admin')));
  }
}

function showResult(title, nodes) {
  const card = qs(panel, '#result-card');
  card.hidden = false;
  qs(panel, '#result-title').textContent = title;
  const box = qs(panel, '#result');
  box.replaceChildren(...nodes);
}

async function onRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs(form, '#reg-submit');
  const errorNode = qs(form, '#reg-error');
  const okNode = qs(form, '#reg-ok');
  setError(errorNode, '');
  okNode.textContent = '';
  const name = cleanName(qs(form, '#reg-name').value);
  const phone = normalizePhone(qs(form, '#reg-phone').value);
  if (!name) {
    setError(errorNode, '이름을 입력해 주세요. 40자 이하입니다.');
    return;
  }
  if (!phone) {
    setError(errorNode, '휴대폰 번호는 010-1234-5678 형식으로 입력해 주세요.');
    return;
  }
  if (!qs(form, '#reg-consent').checked) {
    setError(errorNode, '개인정보 수집·이용 동의를 받은 뒤에 등록할 수 있습니다.');
    return;
  }
  setBusy(button, true);
  try {
    const existing = await dbMod.getDocs(dbMod.query(
      dbMod.collection(db, 'users'),
      dbMod.where('phone', '==', phone),
      dbMod.limit(1),
    ));
    if (!existing.empty) {
      setError(errorNode, '이미 입장한 손님입니다. 번호로 조회하세요.');
      return;
    }
    const pendingRef = dbMod.doc(db, 'pending', phone);
    const pendingSnap = await dbMod.getDoc(pendingRef);
    if (pendingSnap.exists()) {
      setError(errorNode, `이미 대기 중입니다. 초기 비밀번호는 ${last4(phone)}입니다.`);
      return;
    }
    await dbMod.setDoc(pendingRef, {
      name,
      phone,
      createdBy: auth.currentUser.uid,
      createdAt: dbMod.serverTimestamp(),
      consent: true,
    });
    form.reset();
    okNode.textContent = `대기 등록했습니다. 초기 비밀번호는 ${last4(phone)}입니다. 손님에게 말로 안내하세요. 아이디는 휴대폰 번호이고, 들어가서 바로 비밀번호를 바꾸면 됩니다. 지금 손님 폰에서 처리하고, 대기 상태로 오래 두지 마세요.`;
  } catch (error) {
    setError(errorNode, authErrorMessage(error, 'admin'));
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

function memberNodes(id, data) {
  const stamps = Number(data.stamps) || 0;
  const wrap = el('div');
  wrap.append(
    el('p', '', `${data.name || '손님'} · ${formatPhone(data.phone)}`),
    el('p', 'count', `${stamps} / 10`),
    el('p', 'remain', stamps >= 10
      ? '무료 이용을 사용할 수 있습니다.'
      : `무료까지 ${Math.max(0, 10 - stamps)}개`),
    el('p', 'totals', `누적 적립 ${Number(data.totalEarned) || 0}회 · 무료 이용 ${Number(data.totalRedeemed) || 0}회`),
  );
  const actions = el('div', 'actions');
  const earn = el('button', 'primary', '적립 +1');
  earn.type = 'button';
  earn.disabled = stamps >= 10;
  earn.addEventListener('click', () => { void changeStamps(id, 'earn'); });
  const deduct = el('button', 'ghost', '1회 차감');
  deduct.type = 'button';
  deduct.disabled = stamps < 1;
  deduct.addEventListener('click', () => {
    if (!window.confirm('스탬프 1개를 차감할까요?')) return;
    void changeStamps(id, 'deduct');
  });
  const redeem = el('button', 'secondary wide', '10회 사용');
  redeem.type = 'button';
  redeem.disabled = stamps < 10;
  redeem.addEventListener('click', () => { void changeStamps(id, 'redeem'); });
  actions.append(earn, deduct, redeem);
  wrap.append(actions);
  const note = el('p', 'help', stamps >= 10
    ? '10개입니다. 무료 이용을 먼저 사용해 주세요.'
    : '10개 미만이면 무료 이용을 쓸 수 없습니다.');
  wrap.append(note);
  const status = el('p', 'form-ok', '');
  status.id = 'act-ok';
  const error = el('p', 'form-error', '');
  error.id = 'act-error';
  error.setAttribute('role', 'alert');
  wrap.append(status, error);
  return [wrap];
}

function pendingNodes(data) {
  const phone = data.phone;
  const wrap = el('div');
  wrap.append(
    el('p', '', `${data.name || '손님'} · ${formatPhone(phone)}`),
    el('p', 'help', '아직 첫 입장 전입니다.'),
  );
  const callout = el('div', 'callout');
  callout.append(el('p', '', '초기 비밀번호'));
  callout.append(el('strong', '', last4(phone)));
  callout.append(el('p', '', '손님에게 말로 안내하세요. 이 화면을 손님 쪽에 오래 띄우지 마세요.'));
  wrap.append(callout);
  const cancel = el('button', 'ghost', '대기 취소');
  cancel.type = 'button';
  cancel.addEventListener('click', () => { void cancelPending(phone); });
  wrap.append(cancel);
  const status = el('p', 'form-error', '');
  status.id = 'act-error';
  wrap.append(status);
  return [wrap];
}

async function cancelPending(phone) {
  const errorNode = document.getElementById('act-error');
  try {
    await dbMod.deleteDoc(dbMod.doc(db, 'pending', phone));
    showResult('대기 취소', [el('p', '', `${formatPhone(phone)} 대기를 지웠습니다.`)]);
  } catch (error) {
    if (errorNode) setError(errorNode, authErrorMessage(error, 'admin'));
  }
}

async function changeStamps(id, type) {
  const errorNode = document.getElementById('act-error');
  const okNode = document.getElementById('act-ok');
  if (errorNode) errorNode.textContent = '';
  if (okNode) okNode.textContent = '';
  const buttons = [...panel.querySelectorAll('#result button')];
  const previous = buttons.map((button) => button.disabled);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await dbMod.runTransaction(db, async (tx) => {
      const ref = dbMod.doc(db, 'users', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw Object.assign(new Error('MISSING'), { code: 'MISSING' });
      const data = snap.data();
      const stamps = data.stamps;
      if (typeof stamps !== 'number') throw Object.assign(new Error('BAD_DATA'), { code: 'BAD_DATA' });
      if (type === 'earn' && stamps >= 10) throw Object.assign(new Error('FULL'), { code: 'FULL' });
      if (type === 'redeem' && stamps < 10) throw Object.assign(new Error('SHORT'), { code: 'SHORT' });
      if (type === 'deduct' && stamps < 1) throw Object.assign(new Error('EMPTY'), { code: 'EMPTY' });
      if (type === 'deduct' && (typeof data.totalEarned !== 'number' || data.totalEarned < 1)) {
        throw Object.assign(new Error('EMPTY'), { code: 'EMPTY' });
      }
      const stampsAfter = type === 'earn' ? stamps + 1 : stamps - (type === 'deduct' ? 1 : 10);
      const patch = {
        stamps: stampsAfter,
        updatedAt: dbMod.serverTimestamp(),
      };
      if (type === 'earn') patch.totalEarned = data.totalEarned + 1;
      else if (type === 'deduct') patch.totalEarned = data.totalEarned - 1;
      else patch.totalRedeemed = data.totalRedeemed + 1;
      tx.update(ref, patch);
      tx.set(dbMod.doc(dbMod.collection(db, 'logs')), {
        uid: id,
        phone: data.phone,
        type,
        byAdminUid: auth.currentUser.uid,
        createdAt: dbMod.serverTimestamp(),
        stampsAfter,
      });
    });
    const fresh = await dbMod.getDoc(dbMod.doc(db, 'users', id));
    showResult('조회 결과', memberNodes(id, fresh.data()));
    const ok = document.getElementById('act-ok');
    const done = {
      earn: '스탬프를 1개 적립했습니다.',
      deduct: '스탬프를 1개 차감했습니다.',
      redeem: '무료 이용 1회를 사용 처리했습니다.',
    };
    if (ok) ok.textContent = done[type];
    await refreshLogs();
  } catch (error) {
    buttons.forEach((button, index) => {
      if (button.isConnected) button.disabled = previous[index];
    });
    if (!errorNode) return;
    if (error.code === 'FULL') setError(errorNode, '10개입니다. 무료 이용을 먼저 사용해 주세요.');
    else if (error.code === 'SHORT') setError(errorNode, '10개가 차야 사용할 수 있습니다.');
    else if (error.code === 'EMPTY') setError(errorNode, '차감할 스탬프가 없습니다.');
    else if (error.code === 'MISSING') setError(errorNode, '손님 기록을 찾지 못했습니다.');
    else setError(errorNode, authErrorMessage(error, 'admin'));
  }
}

async function onLookup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs(form, '#find-submit');
  const errorNode = qs(form, '#find-error');
  setError(errorNode, '');
  const phone = normalizePhone(qs(form, '#find-phone').value);
  if (!phone) {
    setError(errorNode, '휴대폰 번호는 010-1234-5678 형식으로 입력해 주세요.');
    return;
  }
  setBusy(button, true);
  try {
    const users = await dbMod.getDocs(dbMod.query(
      dbMod.collection(db, 'users'),
      dbMod.where('phone', '==', phone),
      dbMod.limit(1),
    ));
    if (!users.empty) {
      const found = users.docs[0];
      showResult('조회 결과', memberNodes(found.id, found.data()));
      const pendingSnap = await dbMod.getDoc(dbMod.doc(db, 'pending', phone));
      if (pendingSnap.exists()) {
        const extra = el('p', 'help', '같은 번호의 대기 등록이 남아 있습니다. 필요하면 대기를 지우세요.');
        const cancel = el('button', 'ghost', '남은 대기 지우기');
        cancel.type = 'button';
        cancel.addEventListener('click', () => { void cancelPending(phone); });
        qs(panel, '#result').append(extra, cancel);
      }
      return;
    }
    const pendingSnap = await dbMod.getDoc(dbMod.doc(db, 'pending', phone));
    if (pendingSnap.exists()) {
      showResult('입장 대기', pendingNodes(pendingSnap.data()));
      return;
    }
    showResult('조회 결과', [el('p', '', '등록되지 않은 번호입니다. 먼저 신규 등록을 하세요.')]);
  } catch (error) {
    setError(errorNode, authErrorMessage(error, 'admin'));
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = qs(form, '#login');
  const errorNode = qs(form, '#form-error');
  setError(errorNode, '');
  const email = qs(form, '#email').value.trim();
  const password = qs(form, '#password').value;
  if (!email || !password) {
    setError(errorNode, '이메일과 비밀번호를 입력해 주세요.');
    return;
  }
  setBusy(button, true);
  try {
    await authMod.signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (button.isConnected) setError(errorNode, authErrorMessage(error, 'admin'));
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

async function settle(user, gen) {
  if (!user) {
    if (gen !== generation) return;
    renderLogin();
    return;
  }
  try {
    const adminSnap = await dbMod.getDoc(dbMod.doc(db, 'admins', user.uid));
    if (gen !== generation) return;
    if (!adminSnap.exists()) {
      flash = '직원 계정이 아닙니다. 손님은 손님 화면에서 휴대폰 번호로 로그인합니다.';
      await authMod.signOut(auth);
      return;
    }
    renderApp(user);
  } catch (error) {
    if (gen !== generation) return;
    renderNotice('다시 시도해 주세요', authErrorMessage(error, 'admin'));
  }
}

async function main() {
  try {
    const boot = await bootFirebase('gsgolf-admin');
    auth = boot.auth;
    db = boot.db;
    authMod = boot.authMod;
    dbMod = boot.dbMod;
  } catch (error) {
    if (error.code === 'CDN_FAILED') {
      renderNotice('연결을 확인하지 못했습니다', 'Firebase 라이브러리를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 여세요.');
      return;
    }
    renderNotice(
      '설정이 필요합니다',
      'Firebase 웹 설정이 아직 없습니다. README대로 js/firebase-config.js 를 만든 뒤 다시 여세요.',
    );
    return;
  }
  authMod.onAuthStateChanged(auth, (user) => {
    const gen = ++generation;
    void settle(user, gen);
  });
}

void main();
