import { ConsumerService } from "./consumer.service";

describe("ConsumerService", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  const createContext = () => {
    const ack = jest.fn();
    const nack = jest.fn();
    const originalMessage = { fields: { routingKey: "shoporders_event" } };

    return {
      ack,
      nack,
      originalMessage,
      context: {
        getChannelRef: () => ({ ack, nack }),
        getMessage: () => originalMessage,
        getPattern: () => "shoporders_event",
      },
    };
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DRUPAL_REST_URL: "https://drupal.example.com/api/shoporders",
      DRUPAL_JWT_TOKEN: "test-token",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("forwards shoporders payload and acknowledges the message", async () => {
    const executeById = jest.fn().mockResolvedValue({});
    const service = new ConsumerService(
      { executeById } as never,
      { get: jest.fn() } as never,
    );
    const { ack, originalMessage, context } = createContext();

    await service.handleShopordersUpdate(
      {
        message: JSON.stringify({
          data: {
            orders: [{ ISIN: "US123", QTY: 1 }],
          },
        }),
      },
      context,
    );

    expect(executeById).toHaveBeenCalledWith("shoporders.update", {
      orders: [{ ISIN: "US123", QTY: 1 }],
    });
    expect(ack).toHaveBeenCalledWith(originalMessage);
  });

  it("acknowledges the message when shoporders forwarding fails", async () => {
    const executeById = jest.fn().mockRejectedValue(new Error("boom"));
    const service = new ConsumerService(
      { executeById } as never,
      { get: jest.fn() } as never,
    );
    const { ack, originalMessage, context } = createContext();

    await service.handleShopordersUpdate(
      {
        message: JSON.stringify({
          data: {
            orders: [{ ISIN: "US123", QTY: 1 }],
          },
        }),
      },
      context,
    );

    expect(ack).toHaveBeenCalledWith(originalMessage);
  });

  it("extracts only the first row for each unique ISIN", () => {
    const service = new ConsumerService({} as never, { get: jest.fn() } as never);

    const rows = (service as any).extractShopordersRows({
      data: {
        orders: [
          { ISIN: "US123", QTY: 1 },
          { ISIN: "us123", QTY: 2 },
          { ISIN: "DE456", QTY: 3 },
        ],
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row: { ISIN: string }) => row.ISIN)).toEqual(["US123", "DE456"]);
  });
});
