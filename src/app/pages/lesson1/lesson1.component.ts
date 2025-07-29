import { Component, OnInit } from '@angular/core';
import * as crypto from 'crypto-js';
import { CryptoService } from '../../services/crypto.service';

@Component({
  selector: 'app-lesson1',
  templateUrl: './lesson1.component.html',
  styleUrls: ['./lesson1.component.scss']
})
export class Lesson1Component implements OnInit {
  constructor(private cryptoService: CryptoService) {}

  async ngOnInit() {
    try {
      await this.cryptoService['initialize']();
      console.log('CryptoService initialized in Lesson1Component');
    } catch (error) {
      console.error('Failed to initialize CryptoService in Lesson1Component:', error);
    }
  }
  input = 'Hello, WASM!';
  wasmResult = '';
  jsResult = '';
  wasmTime = 0;
  jsTime = 0;

  async runHash() {
    // 🕒 WASM
    const t0 = performance.now();
    try {
      this.wasmResult = await this.cryptoService.sha256(this.input);
    } catch (error) {
      console.error('Error running WASM hash:', error);
      this.wasmResult = 'Error computing hash';
    }
    const t1 = performance.now();
    this.wasmTime = +(t1 - t0).toFixed(2);

    // 🕒 JS
    const t2 = performance.now();
    this.jsResult = crypto.SHA256(this.input).toString();
    const t3 = performance.now();
    this.jsTime = +(t3 - t2).toFixed(2);
  }
}
