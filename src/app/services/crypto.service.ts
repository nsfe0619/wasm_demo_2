import { Injectable } from '@angular/core';
import { createSHA256, IHasher } from 'hash-wasm';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private hasher: IHasher | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the WASM hasher
   * Can be called manually to pre-load the WASM module
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.hasher = await createSHA256();
        this.isInitialized = true;
        console.log('WASM CryptoService initialized successfully');
      } catch (error) {
        console.error('Failed to initialize CryptoService:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Compute SHA-256 hash of the input string
   * @param input The string to hash
   * @returns Promise that resolves to the hex-encoded hash string
   */
  public async sha256(input: string): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.hasher) {
      throw new Error('CryptoService not properly initialized');
    }
    
    try {
      return this.hasher.init()
        .update(input)
        .digest('hex');
    } catch (error) {
      console.error('Error computing hash:', error);
      throw error;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}
