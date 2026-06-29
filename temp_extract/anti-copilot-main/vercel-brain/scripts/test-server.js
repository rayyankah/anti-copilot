// Using native fetch in Node 18+

async function testActionApi() {
  console.log('Testing POST /api/action...');
  const payload = {
    userId: 'test-user-123',
    username: 'SpaghettiCoder_99',
    trigger: 'terminal_error',
    timestamp: Date.now(),
    metadata: { errorCount: 1 }
  };

  try {
    const response = await fetch('http://localhost:3000/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Action API Success! Received AI Action:', data);
  } catch (err) {
    console.error('❌ Action API Failed:', err.message);
  }
}

async function testLeaderboardApi() {
  console.log('\nTesting GET /api/leaderboard...');
  try {
    const response = await fetch('http://localhost:3000/api/leaderboard');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('✅ Leaderboard API Success! Leaderboard:', data);
  } catch (err) {
    console.error('❌ Leaderboard API Failed:', err.message);
  }
}

async function runTests() {
  console.log('Ensure you have "npm run dev:brain" running in another terminal!');
  console.log('--------------------------------------------------------------');
  await testActionApi();
  await testLeaderboardApi();
}

runTests();
