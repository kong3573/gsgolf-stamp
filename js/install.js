const button = document.getElementById('save-app');
const dialog = document.getElementById('install-help');
const steps = document.getElementById('install-steps');

let deferredPrompt = null;
let loggedIn = false;

function installed() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function ios() {
  const agent = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(agent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function inAppBrowser() {
  return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(window.navigator.userAgent || '');
}

function refresh() {
  if (!button) return;
  button.hidden = !loggedIn || installed();
}

export function setCustomerLoggedIn(value) {
  loggedIn = value;
  refresh();
}

function stepList(lines) {
  steps.replaceChildren(...lines.map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
}

function showHelp() {
  if (inAppBrowser()) {
    stepList([
      '카카오톡이나 인스타그램 안에서는 바탕화면 아이콘을 만들 수 없습니다.',
      '오른쪽 위 메뉴에서 Safari 또는 Chrome으로 이 페이지를 엽니다.',
      '로그인한 뒤 앱 저장을 다시 누릅니다.',
    ]);
  } else if (ios()) {
    stepList([
      'Safari 화면 아래의 공유 버튼을 누릅니다.',
      '홈 화면에 추가를 누릅니다.',
      '추가를 누르면 바탕화면에 광산골프 아이콘이 생깁니다. 아이콘을 누르면 스탬프 화면이 바로 열립니다.',
    ]);
  } else {
    stepList([
      'Chrome 오른쪽 위 메뉴를 누릅니다.',
      '홈 화면에 추가 또는 앱 설치를 누릅니다.',
      '추가하면 바탕화면 아이콘으로 스탬프 화면이 바로 열립니다.',
    ]);
  }
  dialog.showModal();
}

if (button && dialog) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    refresh();
  });
  button.addEventListener('click', async () => {
    if (!deferredPrompt) {
      showHelp();
      return;
    }
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === 'accepted') refresh();
    } catch {
      deferredPrompt = null;
      showHelp();
    }
  });
  document.getElementById('install-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
