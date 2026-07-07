function TeacherHeader() {
  return (
    <header className="flex h-16 w-full items-center bg-main-200 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <img
          src="/BetterEmptyConsoleLogo copy.png"
          alt="Student Atlas logo"
          className="h-10 w-10 rounded-lg"
        />
        <span className="text-5xl leading-none font-bold text-[#4169e1]">
          Atlas
        </span>
      </div>
    </header>
  );
}

export default TeacherHeader;
