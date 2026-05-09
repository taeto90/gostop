import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

/**
 * 로비 / 비밀방 입장 모달에서 공통 사용하는 비밀번호 input.
 * 보기/숨김 토글 + Enter 키 submit 콜백.
 */
export function PasswordInput({
  value,
  onChange,
  onEnter,
  placeholder,
  maxLength = 20,
  autoFocus = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        maxLength={maxLength}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full rounded-md border border-green-700 bg-green-950/50 px-3 py-2 pr-12 text-sm text-white placeholder:text-green-600 focus:border-amber-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-green-200"
      >
        {show ? '숨김' : '보기'}
      </button>
    </div>
  );
}
