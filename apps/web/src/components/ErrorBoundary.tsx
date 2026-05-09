import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 글로벌 ErrorBoundary — 자식 컴포넌트의 throw된 에러를 catch해 fallback UI 표시.
 * 새로고침으로 복구 가능. 친구 게임 중 한 컴포넌트 에러로 전체 빈 화면 되는 것 방지.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-felt p-6 text-felt-50">
        <div className="max-w-md rounded-2xl border-2 border-rose-500/60 bg-felt-900 p-6 shadow-2xl">
          <h2 className="mb-3 text-xl font-bold text-rose-300">⚠️ 앱 오류</h2>
          <p className="mb-3 text-sm text-felt-200">
            예기치 않은 오류가 발생했습니다. 페이지를 새로고침해 주세요.
          </p>
          <pre className="mb-4 max-h-48 overflow-auto rounded bg-felt-950 p-3 text-[11px] text-felt-300">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              🔄 새로고침
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
            >
              계속
            </button>
          </div>
        </div>
      </div>
    );
  }
}
