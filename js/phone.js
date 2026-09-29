export const EMAIL_DOMAIN = 'stamp.gsgolf.local';

const PHONE_PATTERN = /^01[016789]-?[0-9]{3,4}-?[0-9]{4}$/;
const DIGIT_PATTERN = /^01[016789][0-9]{7,8}$/;

export function normalizePhone(input) {
  const compact = String(input ?? '').trim().replace(/\s+/g, '');
  if (!PHONE_PATTERN.test(compact)) return null;
  const digits = compact.replace(/\D/g, '');
  if (!DIGIT_PATTERN.test(digits)) return null;
  return digits;
}

export function last4(phone) {
  return phone.slice(-4);
}

// Firebase는 6자 미만 비밀번호를 거절한다.
// 손님은 뒷자리 4자리만 입력하고, 서버로 보낼 때만 그 4자리를 두 번 붙인다.
export function initialAuthPassword(phone) {
  const tail = last4(phone);
  return `${tail}${tail}`;
}

export function toAuthEmail(phone) {
  return `${phone}@${EMAIL_DOMAIN}`;
}

export function phoneFromEmail(email) {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain !== EMAIL_DOMAIN) return null;
  if (!DIGIT_PATTERN.test(local)) return null;
  return local;
}

export function formatPhone(phone) {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

export function maskPhone(phone) {
  const parts = formatPhone(phone).split('-');
  if (parts.length !== 3) return phone;
  return `${parts[0]}-****-${parts[2]}`;
}

export function cleanName(input) {
  const name = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40) return null;
  if (/[\u0000-\u001f]/.test(name)) return null;
  return name;
}

export function passwordsForSignIn(phone, typed) {
  if (typeof typed !== 'string' || typed.length === 0) return [];
  if (typed === last4(phone)) return [initialAuthPassword(phone)];
  if (typed.length >= 6) return [typed];
  return [];
}

export function validateNewPassword(phone, currentTyped, next, confirm) {
  if (!next || !confirm) return '새 비밀번호를 두 번 입력해 주세요.';
  if (next !== confirm) return '새 비밀번호가 서로 다릅니다.';
  if (next.length < 6) return '새 비밀번호는 6자 이상으로 정해 주세요.';
  if (next.length > 64) return '비밀번호는 64자 이하로 정해 주세요.';
  if (next === last4(phone) || next === initialAuthPassword(phone)) {
    return '초기 비밀번호(뒷자리 4자리)는 다시 쓸 수 없습니다.';
  }
  if (next === currentTyped) return '지금 비밀번호와 다른 비밀번호로 바꿔 주세요.';
  return '';
}
