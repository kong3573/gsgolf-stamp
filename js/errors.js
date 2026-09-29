function codeOf(error) {
  return String(error?.code || '');
}

export function authErrorMessage(error, kind) {
  const code = codeOf(error);
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return kind === 'admin'
      ? '이메일 또는 비밀번호가 올바르지 않습니다.'
      : '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.';
  }
  if (code === 'auth/too-many-requests') return '시도가 많습니다. 잠시 후 다시 해 주세요.';
  if (code === 'auth/user-disabled') return '사용할 수 없는 계정입니다. 카운터에 문의해 주세요.';
  if (code === 'auth/unauthorized-domain') {
    return '이 주소가 Firebase 승인된 도메인에 없습니다. README의 도메인 추가를 확인해 주세요.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase에서 이메일/비밀번호 로그인을 켜 주세요.';
  }
  if (code === 'auth/weak-password') {
    return 'Firebase 비밀번호 정책이 초기 비밀번호를 막았습니다. 최소 6자만 두고, 대문자·특수문자 필수는 끄세요.';
  }
  if (code === 'auth/network-request-failed') return '네트워크에 연결하지 못했습니다.';
  if (code === 'auth/requires-recent-login') return '다시 로그인한 뒤 비밀번호를 바꿔 주세요.';
  if (code.includes('permission-denied')) {
    return '권한이 없습니다. Firestore 규칙을 게시했는지 확인해 주세요.';
  }
  if (code === 'CONFIG_MISSING' || code === 'CONFIG_PLACEHOLDER') {
    return 'Firebase 설정 파일이 없습니다.';
  }
  return '처리하지 못했습니다. 잠시 후 다시 해 주세요.';
}
