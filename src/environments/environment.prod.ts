export const environment = {
  production: true,
  apiUrl: 'http://localhost:8080', // Update this for production deployment
  agentEndpoint: '/api/agent/run',
  threadsEndpoint: '/api/threads',
  maxMessageHistory: 50,
  userId: 'dev-user', // TODO: Replace with real auth
};
