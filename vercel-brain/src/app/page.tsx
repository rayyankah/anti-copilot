export default function HomePage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: 800,
        background: 'linear-gradient(135deg, #ff2d2d, #ff6b00)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '1rem',
      }}>
        🏆 Global Hall of Shame
      </h1>
      <p style={{
        color: '#888',
        fontSize: '1.2rem',
        maxWidth: '600px',
        textAlign: 'center',
        lineHeight: 1.6,
      }}>
        The live leaderboard of the worst developers using Anti-Copilot,
        ranked by their most embarrassing, frequently repeated errors.
      </p>
      <p style={{
        color: '#555',
        marginTop: '2rem',
        fontStyle: 'italic',
      }}>
        Powered by Vercel + AWS DynamoDB
      </p>
    </main>
  );
}
