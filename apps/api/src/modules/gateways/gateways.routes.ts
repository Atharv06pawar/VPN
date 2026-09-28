import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { wireguardManager } from '../../lib/wireguard.js';

export const gatewayRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/gateways - List available gateways
  fastify.get('/', async (_request, reply) => {
    const health = await wireguardManager.getGatewayHealth();
    return reply.send({
      success: true,
      data: [
        {
          id: health.id,
          name: health.name,
          status: health.status,
          endpoint: health.endpoint,
          activePeers: health.activePeers,
          location: 'Mumbai, India 🇮🇳',
          countryCode: 'IN',
        },
      ],
    });
  });

  // GET /api/gateways/:id/status - Real gateway telemetry
  fastify.get('/:id/status', async (_request, reply) => {
    const health = await wireguardManager.getGatewayHealth();
    return reply.send({
      success: true,
      data: health,
    });
  });
};
