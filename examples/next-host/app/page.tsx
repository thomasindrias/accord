export default function HomePage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Accord Next.js Host</h1>
      <csx-user-card userId="user-123" readonly={false} />
    </main>
  );
}
