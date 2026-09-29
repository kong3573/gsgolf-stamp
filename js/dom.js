export function mount(templateId) {
  const panel = document.getElementById('panel');
  const template = document.getElementById(templateId);
  panel.replaceChildren(template.content.cloneNode(true));
  return panel;
}

export function qs(root, selector) {
  return root.querySelector(selector);
}

export function setText(root, selector, text) {
  const node = qs(root, selector);
  if (node) node.textContent = text;
}

export function setError(node, message) {
  if (!node) return;
  node.textContent = message || '';
}

export function setBusy(button, busy) {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? '처리 중…' : button.dataset.label;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function formatWhen(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return '방금';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}
