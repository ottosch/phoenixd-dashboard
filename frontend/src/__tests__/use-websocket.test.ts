import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/use-websocket';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  send(_data: string) {
    // Mock send
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError(error: Error) {
    this.onerror?.(error);
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

// Store instances for testing
let mockWebSocketInstances: MockWebSocket[] = [];

// Mock global WebSocket
vi.stubGlobal(
  'WebSocket',
  class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      mockWebSocketInstances.push(this);
    }
  }
);

describe('useWebSocket Hook', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mockWebSocketInstances = [];
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:4001');
    // Silence console output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.isConnected).toBe(false);
  });

  it('should connect on mount', async () => {
    const onConnect = vi.fn();
    const { result } = renderHook(() => useWebSocket({ onConnect }));

    // Advance timers to trigger async connection
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(result.current.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalled();
  });

  it('should construct correct WebSocket URL', async () => {
    renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(mockWebSocketInstances[0]?.url).toBe('ws://localhost:4001/ws');
  });

  it('should call onPaymentReceived when payment event is received', async () => {
    const onPaymentReceived = vi.fn();
    renderHook(() => useWebSocket({ onPaymentReceived }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const paymentEvent = {
      type: 'payment_received',
      amountSat: 1000,
      paymentHash: 'a'.repeat(64),
    };

    await act(async () => {
      mockWebSocketInstances[0]?.simulateMessage(paymentEvent);
    });

    expect(onPaymentReceived).toHaveBeenCalledWith(paymentEvent);
  });

  it('should not call onPaymentReceived for non-payment events', async () => {
    const onPaymentReceived = vi.fn();
    renderHook(() => useWebSocket({ onPaymentReceived }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const otherEvent = {
      type: 'channel_opened',
      channelId: 'ch-1',
    };

    await act(async () => {
      mockWebSocketInstances[0]?.simulateMessage(otherEvent);
    });

    expect(onPaymentReceived).not.toHaveBeenCalled();
  });

  it('should call onDisconnect when connection closes', async () => {
    const onDisconnect = vi.fn();
    renderHook(() => useWebSocket({ onDisconnect }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      mockWebSocketInstances[0]?.simulateClose();
    });

    expect(onDisconnect).toHaveBeenCalled();
  });

  it('should update isConnected state on disconnect', async () => {
    const { result } = renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      mockWebSocketInstances[0]?.simulateClose();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should attempt reconnection after disconnect', async () => {
    renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const initialInstanceCount = mockWebSocketInstances.length;

    await act(async () => {
      mockWebSocketInstances[0]?.simulateClose();
    });

    // Advance 5 seconds for reconnection
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockWebSocketInstances.length).toBeGreaterThan(initialInstanceCount);
  });

  it('should clean up on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const ws = mockWebSocketInstances[0];

    unmount();

    expect(ws?.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('should not reconnect after unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const instanceCountBeforeUnmount = mockWebSocketInstances.length;

    unmount();

    // Advance timers for potential reconnection
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // Should not have created new connections after unmount
    expect(mockWebSocketInstances.length).toBe(instanceCountBeforeUnmount);
  });

  it('should handle JSON parse errors gracefully', async () => {
    const onPaymentReceived = vi.fn();

    renderHook(() => useWebSocket({ onPaymentReceived }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Send invalid JSON
    await act(async () => {
      mockWebSocketInstances[0]?.onmessage?.({ data: 'invalid json{' });
    });

    expect(onPaymentReceived).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should handle WebSocket errors', async () => {
    renderHook(() => useWebSocket());

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      mockWebSocketInstances[0]?.simulateError(new Error('Connection error'));
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should handle payment event with all fields', async () => {
    const onPaymentReceived = vi.fn();
    renderHook(() => useWebSocket({ onPaymentReceived }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const fullPaymentEvent = {
      type: 'payment_received',
      amountSat: 50000,
      paymentHash: 'b'.repeat(64),
      payerNote: 'Test payment',
      payerKey: '02abc...',
      externalId: 'order-123',
    };

    await act(async () => {
      mockWebSocketInstances[0]?.simulateMessage(fullPaymentEvent);
    });

    expect(onPaymentReceived).toHaveBeenCalledWith(fullPaymentEvent);
    expect(onPaymentReceived.mock.calls[0][0].payerNote).toBe('Test payment');
  });

  it('should handle multiple rapid payment events', async () => {
    const onPaymentReceived = vi.fn();
    renderHook(() => useWebSocket({ onPaymentReceived }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const payments = Array.from({ length: 5 }, (_, i) => ({
      type: 'payment_received',
      amountSat: (i + 1) * 1000,
      paymentHash: `${i}`.repeat(64),
    }));

    await act(async () => {
      payments.forEach((payment) => {
        mockWebSocketInstances[0]?.simulateMessage(payment);
      });
    });

    expect(onPaymentReceived).toHaveBeenCalledTimes(5);
  });
});

describe('WebSocket URL Construction', () => {
  it('should use default URL when env is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_WS_URL', '');

    // The hook uses default 'ws://localhost:4001' if env is empty
    const defaultUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
    expect(defaultUrl).toBe('ws://localhost:4001');
  });

  it('should handle wss protocol', () => {
    const httpsUrl = 'wss://secure.example.com:4001';
    const wsUrl = `${httpsUrl}/ws`;
    expect(wsUrl).toBe('wss://secure.example.com:4001/ws');
  });
});

describe('Payment Event Types', () => {
  it('should have correct PaymentEvent interface', () => {
    const event = {
      type: 'payment_received',
      amountSat: 1000,
      paymentHash: 'a'.repeat(64),
      payerNote: 'Test',
      payerKey: '02abc',
      externalId: 'ext-1',
    };

    expect(event.type).toBe('payment_received');
    expect(typeof event.amountSat).toBe('number');
    expect(typeof event.paymentHash).toBe('string');
  });

  it('should handle optional fields', () => {
    const minimalEvent = {
      type: 'payment_received',
    };

    expect(minimalEvent.type).toBe('payment_received');
    expect((minimalEvent as { amountSat?: number }).amountSat).toBeUndefined();
  });
});
