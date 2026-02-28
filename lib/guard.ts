export type CordonScope = 'fs.read' | 'fs.write' | 'net' | 'worker';

export const Cordon = {
  /**
   * Checks if the current process has the requested capability.
   */
  has(scope: CordonScope, reference: string): boolean {
    const nodeProcess = process as any;
    if (!nodeProcess.permission) return true; 
    return nodeProcess.permission.has(scope, reference);
  },

  /**
   * Protects a function call by checking permissions first.
   * Returns a fallback value if the operation is blocked.
   */
  async shield<T>(
    scope: CordonScope,
    reference: string,
    action: () => Promise<T> | T,
    fallback: T
  ): Promise<T> {
    if (!this.has(scope, reference)) {
      console.warn(`[cordon] Blocked ${scope} access to: ${reference}`);
      return fallback;
    }
    return action();
  }
};