type AtlasWordmarkProps = {
  className?: string;
};

function AtlasWordmark({ className = "" }: AtlasWordmarkProps) {
  return (
    <span
      aria-label="Atlas"
      className={`relative -top-[2.5px] font-sans text-5xl leading-none font-semibold text-primary ${className}`}
    >
      tlas
    </span>
  );
}

export default AtlasWordmark;
