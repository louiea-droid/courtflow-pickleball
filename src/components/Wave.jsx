// The brand wave under a deep green card (Home's welcome band, the club's Open play cards).
export default function Wave({ className = "home-hero-wave" }) {
  return (
    <svg className={className} viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40 C150 10 280 60 430 32 S700 8 800 26 V70 H0Z" fill="var(--lime)" />
      <path d="M0 52 C160 26 300 72 460 46 S720 24 800 40 V70 H0Z" fill="var(--brand-green)" />
    </svg>
  );
}
