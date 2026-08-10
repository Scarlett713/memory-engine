import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-20">
      <section className="paper-panel paper-panel-strong w-full rounded-[2rem] p-10 text-center">
        <p className="section-eyebrow">档案检索失败</p>
        <h1 className="font-display mt-4 text-4xl font-semibold text-accent-strong">
          未找到对应的口述项目
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted">
          当前链接对应的项目记录不存在，或本地示例数据已被清空。你可以返回工作台重新上传一段受访音频，生成新的项目档案。
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-deep px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          返回工作台
        </Link>
      </section>
    </main>
  );
}
