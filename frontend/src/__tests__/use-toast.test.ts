import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast, reducer } from '@/hooks/use-toast';

// Define types for testing
interface ToasterToast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface State {
  toasts: ToasterToast[];
}

type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string };

describe('Toast Reducer', () => {
  describe('ADD_TOAST action', () => {
    it('should add a toast to empty state', () => {
      const initialState: State = { toasts: [] };
      const newToast: ToasterToast = { id: '1', title: 'Test Toast' };

      const action: Action = { type: 'ADD_TOAST', toast: newToast };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].title).toBe('Test Toast');
    });

    it('should add toast at the beginning', () => {
      const initialState: State = {
        toasts: [{ id: '1', title: 'First' }],
      };
      const newToast: ToasterToast = { id: '2', title: 'Second' };

      const action: Action = { type: 'ADD_TOAST', toast: newToast };
      const result = reducer(initialState, action);

      expect(result.toasts[0].id).toBe('2');
      expect(result.toasts[1].id).toBe('1');
    });

    it('should limit toasts to TOAST_LIMIT (3)', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First' },
          { id: '2', title: 'Second' },
          { id: '3', title: 'Third' },
        ],
      };
      const newToast: ToasterToast = { id: '4', title: 'Fourth' };

      const action: Action = { type: 'ADD_TOAST', toast: newToast };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(3);
      expect(result.toasts[0].id).toBe('4');
      expect(result.toasts[2].id).toBe('2'); // '1' was removed
    });
  });

  describe('UPDATE_TOAST action', () => {
    it('should update existing toast', () => {
      const initialState: State = {
        toasts: [{ id: '1', title: 'Original', description: 'Desc' }],
      };

      const action: Action = {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      };
      const result = reducer(initialState, action);

      expect(result.toasts[0].title).toBe('Updated');
      expect(result.toasts[0].description).toBe('Desc'); // Preserved
    });

    it('should not modify other toasts', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First' },
          { id: '2', title: 'Second' },
        ],
      };

      const action: Action = {
        type: 'UPDATE_TOAST',
        toast: { id: '2', title: 'Updated Second' },
      };
      const result = reducer(initialState, action);

      expect(result.toasts[0].title).toBe('First'); // Not modified
      expect(result.toasts[1].title).toBe('Updated Second');
    });

    it('should handle non-existent toast id', () => {
      const initialState: State = {
        toasts: [{ id: '1', title: 'First' }],
      };

      const action: Action = {
        type: 'UPDATE_TOAST',
        toast: { id: 'non-existent', title: 'Updated' },
      };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].title).toBe('First');
    });
  });

  describe('DISMISS_TOAST action', () => {
    it('should dismiss specific toast', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };

      const action: Action = { type: 'DISMISS_TOAST', toastId: '1' };
      const result = reducer(initialState, action);

      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(true);
    });

    it('should dismiss all toasts when no id provided', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      };

      const action: Action = { type: 'DISMISS_TOAST' };
      const result = reducer(initialState, action);

      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(false);
    });
  });

  describe('REMOVE_TOAST action', () => {
    it('should remove specific toast', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First' },
          { id: '2', title: 'Second' },
        ],
      };

      const action: Action = { type: 'REMOVE_TOAST', toastId: '1' };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('should remove all toasts when no id provided', () => {
      const initialState: State = {
        toasts: [
          { id: '1', title: 'First' },
          { id: '2', title: 'Second' },
        ],
      };

      const action: Action = { type: 'REMOVE_TOAST' };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(0);
    });

    it('should handle removing non-existent toast', () => {
      const initialState: State = {
        toasts: [{ id: '1', title: 'First' }],
      };

      const action: Action = { type: 'REMOVE_TOAST', toastId: 'non-existent' };
      const result = reducer(initialState, action);

      expect(result.toasts).toHaveLength(1);
    });
  });
});

describe('useToast Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return toasts array and toast function', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toBeDefined();
    expect(typeof result.current.toast).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
  });

  it('should add toast via toast function', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Test Toast' });
    });

    expect(result.current.toasts.length).toBeGreaterThan(0);
    expect(result.current.toasts[0].title).toBe('Test Toast');
  });

  it('should add toast with description', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Payment Received',
        description: '1000 sats',
      });
    });

    expect(result.current.toasts[0].description).toBe('1000 sats');
  });

  it('should dismiss toast by id', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;

    act(() => {
      const t = result.current.toast({ title: 'Test' });
      toastId = t.id;
    });

    act(() => {
      result.current.dismiss(toastId);
    });

    const dismissedToast = result.current.toasts.find((t) => t.id === toastId);
    expect(dismissedToast?.open).toBe(false);
  });

  it('should dismiss all toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
    });

    act(() => {
      result.current.dismiss();
    });

    result.current.toasts.forEach((t) => {
      expect(t.open).toBe(false);
    });
  });

  it('should return update function from toast', () => {
    const { result } = renderHook(() => useToast());

    let toastResult: { update: (props: Partial<ToasterToast>) => void };

    act(() => {
      toastResult = result.current.toast({ title: 'Original' });
    });

    act(() => {
      toastResult.update({ title: 'Updated' } as ToasterToast);
    });

    expect(result.current.toasts[0].title).toBe('Updated');
  });

  it('should return dismiss function from toast', () => {
    const { result } = renderHook(() => useToast());

    let toastResult: { dismiss: () => void };

    act(() => {
      toastResult = result.current.toast({ title: 'Test' });
    });

    act(() => {
      toastResult.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('should handle multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
    });

    expect(result.current.toasts).toHaveLength(3);
  });

  it('should respect toast limit', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: 'Toast 1' });
      result.current.toast({ title: 'Toast 2' });
      result.current.toast({ title: 'Toast 3' });
      result.current.toast({ title: 'Toast 4' });
    });

    expect(result.current.toasts.length).toBeLessThanOrEqual(3);
  });
});

describe('toast function (standalone)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create toast and return control functions', () => {
    const result = toast({ title: 'Standalone Toast' });

    expect(result.id).toBeDefined();
    expect(typeof result.dismiss).toBe('function');
    expect(typeof result.update).toBe('function');
  });

  it('should generate unique ids', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const result = toast({ title: `Toast ${i}` });
      ids.add(result.id);
    }

    expect(ids.size).toBe(100);
  });
});

describe('Toast Integration Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show payment received notification', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Payment Received! ⚡',
        description: '+1,000 sats',
      });
    });

    expect(result.current.toasts[0].title).toBe('Payment Received! ⚡');
    expect(result.current.toasts[0].description).toBe('+1,000 sats');
  });

  it('should show error notification', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Payment Failed',
        description: 'Insufficient balance',
      });
    });

    expect(result.current.toasts[0].title).toBe('Payment Failed');
  });

  it('should show invoice copied notification', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Copied!',
        description: 'Invoice copied to clipboard',
      });
    });

    expect(result.current.toasts[0].title).toBe('Copied!');
  });

  it('should handle rapid toasts (payment notifications)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.toast({
          title: 'Payment Received',
          description: `+${(i + 1) * 100} sats`,
        });
      }
    });

    // Should be limited to TOAST_LIMIT
    expect(result.current.toasts.length).toBeLessThanOrEqual(3);
  });
});

describe('ID Generation', () => {
  it('should generate incrementing ids', () => {
    const ids: string[] = [];

    for (let i = 0; i < 5; i++) {
      const result = toast({ title: `Toast ${i}` });
      ids.push(result.id);
    }

    // IDs should be sequential numbers as strings
    const numericIds = ids.map((id) => parseInt(id, 10));
    for (let i = 1; i < numericIds.length; i++) {
      expect(numericIds[i]).toBeGreaterThan(numericIds[i - 1]);
    }
  });

  it('should handle id overflow gracefully', () => {
    // The genId function wraps at MAX_SAFE_INTEGER
    // This tests that it doesn't throw
    expect(() => {
      for (let i = 0; i < 1000; i++) {
        toast({ title: `Toast ${i}` });
      }
    }).not.toThrow();
  });
});

describe('State Synchronization', () => {
  it('should sync state across multiple hook instances', () => {
    const { result: result1 } = renderHook(() => useToast());
    const { result: result2 } = renderHook(() => useToast());

    act(() => {
      result1.current.toast({ title: 'From Hook 1' });
    });

    // Both hooks should see the same toast
    expect(result1.current.toasts.length).toBe(result2.current.toasts.length);
  });
});
