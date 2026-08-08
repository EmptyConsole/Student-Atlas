type AtlasWordmarkProps = {
  className?: string;
};

function AtlasWordmark({ className = "" }: AtlasWordmarkProps) {
  return (
    <span
      className={`font-[Plus_Jakarta_Sans] text-5xl leading-none font-semibold text-[#4169e1] ${className}`}
    >
      Atlas
    </span>
  );
}

export default AtlasWordmark;
