import * as React from "react";

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: React.ReactNode;
  glowVariant?: "gold" | "emerald" | "none";
  children: React.ReactNode;
}

export function BentoCard({
  title,
  icon,
  glowVariant = "none",
  children,
  className = "",
  ...props
}: BentoCardProps) {
  const glowClasses = {
    gold: "hover:shadow-glow-gold",
    emerald: "hover:shadow-glow-emerald",
    none: "",
  };

  return (
    <div
      className={[
        "bg-surface-card",
        "dark:bg-surface-1",
        "border border-border-default",
        "rounded-2xl",
        "p-6",
        "shadow-elev-1",
        "hover:shadow-elev-2",
        "transition-shadow duration-300",
        "relative",
        "overflow-hidden",
        "flex flex-col",
        glowClasses[glowVariant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-gold">{icon}</span>}
        <h2 className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default BentoCard;