"use client";

/**
 * Verdict badge — colored pill showing the verdict label.
 * Maps: real → green, suspicious → amber, fake → red.
 */
export default function VerdictBadge({ verdict, size = "md" }) {
  const config = {
    real: {
      bg: "bg-[#EAF3DE]",
      text: "text-[#27500A]",
      border: "border-[#639922]/30",
      label: "Likely Real",
      icon: "✓",
    },
    suspicious: {
      bg: "bg-[#FAEEDA]",
      text: "text-[#633806]",
      border: "border-[#BA7517]/30",
      label: "Suspicious",
      icon: "⚠",
    },
    fake: {
      bg: "bg-[#FCEBEB]",
      text: "text-[#791F1F]",
      border: "border-[#E24B4A]/30",
      label: "Likely Fake",
      icon: "✗",
    },
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const c = config[verdict] || config.suspicious;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase ${c.bg} ${c.text} ${c.border} ${sizeClasses[size]}`}
      style={{ fontFamily: "'Work Sans', sans-serif" }}
    >
      <span>{c.icon}</span>
      {c.label}
    </span>
  );
}
