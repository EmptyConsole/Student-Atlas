type AtlasWordmarkProps = {
  className?: string;
};

function AtlasWordmark({ className = "" }: AtlasWordmarkProps) {
  return (
    <span
      className={`font-[Plus_Jakarta_Sans] text-5xl leading-none font-semibold text-primary ${className}`}
    >
      Atlas
    </span>
  );
}

export default AtlasWordmark;
