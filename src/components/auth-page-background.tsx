/** Single fixed backdrop for login/signup — avoids split backgrounds when scrolling on mobile. */
export function AuthPageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#080810]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.12)_0%,transparent_50%),radial-gradient(circle_at_50%_100%,rgba(20,184,166,0.1)_0%,transparent_45%)]" />
    </div>
  );
}
