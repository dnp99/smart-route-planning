export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "680px",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "1.5rem",
          backgroundColor: "#ffffff",
          boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Smart Route Planner Backend</h1>
        <p style={{ marginTop: "0.75rem", marginBottom: "1rem", color: "#475569" }}>
          Backend API is running.
        </p>

        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#0f172a" }}>
          <li>
            <code>POST /api/optimize-route</code>
          </li>
          <li>
            <code>GET /api/address-autocomplete?query=...</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
