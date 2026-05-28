import { ConsumerService } from './consumer.service';

describe('ConsumerService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  const createContext = () => {
    const ack = jest.fn();
    const nack = jest.fn();
    const originalMessage = { fields: { routingKey: 'shoporders_event' } };

    return {
      ack,
      nack,
      originalMessage,
      context: {
        getChannelRef: () => ({ ack, nack }),
        getMessage: () => originalMessage,
        getPattern: () => 'shoporders_event',
      },
    };
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DRUPAL_REST_URL: 'https://drupal.example.com/api/shoporders',
      DRUPAL_JWT_TOKEN: 'test-token',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts shoporders payload to Drupal and acknowledges the message', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue('created'),
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new ConsumerService();
    const { ack, nack, originalMessage, context } = createContext();

    await service.handleShoporders(
      { message: JSON.stringify({ id: 42, status: 'new' }) },
      context as never,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://drupal.example.com/api/shoporders',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 42, status: 'new' }),
      }),
    );
    expect(ack).toHaveBeenCalledWith(originalMessage);
    expect(nack).not.toHaveBeenCalled();
  });

  it('requeues the message when the Drupal request fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized'),
    });
    global.fetch = fetchMock as typeof fetch;

    const service = new ConsumerService();
    const { ack, nack, originalMessage, context } = createContext();

    await service.handleShoporders(
      { message: JSON.stringify({ id: 42, status: 'new' }) },
      context as never,
    );

    expect(ack).not.toHaveBeenCalled();
    expect(nack).toHaveBeenCalledWith(originalMessage, false, true);
  });
});