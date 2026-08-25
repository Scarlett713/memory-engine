'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

function checkPasswordRules(password: string) {
  return {
    length: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function PasswordRuleHint({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-stone-400'}`}>
      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold
        ${ok ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400'}`}>
        {ok ? '✓' : '·'}
      </span>
      {text}
    </li>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'personal' | 'org'>('personal');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // 密码显示/隐藏状态
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordRules = checkPasswordRules(password);
  const allRulesPassed = Object.values(passwordRules).every(Boolean);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!email) errors.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '邮箱格式不正确';
    if (!password) errors.password = '请输入密码';
    else if (!allRulesPassed) errors.password = '密码不符合要求';
    if (!confirmPassword) errors.confirmPassword = '请确认密码';
    else if (password !== confirmPassword) errors.confirmPassword = '两次输入的密码不一致';
    if (userType === 'org' && !orgName.trim()) errors.orgName = '请输入单位名称';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, userType, orgName }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'EMAIL_EXISTS') {
          setFieldErrors({ email: '该邮箱已注册，请直接登录' });
        } else {
          setError(data.message || '注册失败，请重试');
        }
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('网络连接异常，请检查后重试');
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field: string) =>
    `w-full px-3 py-2 border rounded-lg text-sm
     focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent
     placeholder:text-stone-300 bg-white
     ${fieldErrors[field] ? 'border-red-400' : 'border-stone-300'}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1
            className="text-2xl font-bold text-stone-800 mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            创建账号
          </h1>
          <p className="text-sm text-stone-500">加入记忆引擎，开始记录口述历史</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 账号类型 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">账号类型</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'personal', label: '个人用户', sub: '家庭记忆 · 个人传记' },
                  { value: 'org', label: '机构用户', sub: '档案馆 · 高校 · 研究院' },
                ] as const
              ).map(({ value, label, sub }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUserType(value)}
                  className={`px-4 py-3 rounded-lg border text-sm text-left transition-colors
                    ${userType === value
                      ? 'border-stone-800 bg-stone-800 text-white'
                      : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                    }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className={`text-xs mt-0.5 ${userType === value ? 'text-stone-300' : 'text-stone-400'}`}>
                    {sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 单位名称 */}
          {userType === 'org' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">单位名称</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="如：上海市档案馆"
                className={inputClass('orgName')}
              />
              {fieldErrors.orgName && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.orgName}</p>
              )}
            </div>
          )}

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className={inputClass('email')}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
            )}
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                placeholder="至少8位，含字母和数字"
                autoComplete="new-password"
                className={`${inputClass('password')} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* 密码强度提示 */}
            {passwordFocused && !allRulesPassed && (
              <ul className="mt-2 space-y-1 pl-1">
                <PasswordRuleHint ok={passwordRules.length} text="至少 8 位" />
                <PasswordRuleHint ok={passwordRules.hasLetter} text="包含至少一个字母" />
                <PasswordRuleHint ok={passwordRules.hasNumber} text="包含至少一个数字" />
              </ul>
            )}
            {passwordFocused && allRulesPassed && (
              <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                <span>✓</span> 密码强度符合要求
              </p>
            )}
            {fieldErrors.password && !passwordFocused && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
            )}
          </div>

          {/* 确认密码 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">确认密码</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                className={`${inputClass('confirmPassword')} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                tabIndex={-1}
                aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">两次输入的密码不一致</p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="mt-1 text-xs text-green-600">✓ 密码一致</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-stone-800 text-white text-sm font-medium rounded-lg
                       hover:bg-stone-700 active:bg-stone-900
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors mt-2"
          >
            {loading ? '注册中…' : '创建账号'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          已有账号？{' '}
          <a href="/login" className="text-stone-700 font-medium hover:underline">
            直接登录
          </a>
        </p>

      </div>
    </div>
  );
}
