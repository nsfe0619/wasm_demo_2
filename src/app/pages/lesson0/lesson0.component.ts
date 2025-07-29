import { Component } from '@angular/core';
import { sha256 as wasmSha256 } from 'hash-wasm';
import * as crypto from 'crypto-js';

@Component({
  selector: 'app-lesson0',
  templateUrl: './lesson0.component.html',
  styleUrls: ['./lesson0.component.scss']
})
export class Lesson0Component {
  input = 'Hello, WASM!';
  wasmResult = '';
  jsResult = '';
  wasmTime = 0;
  jsTime = 0;

  async runHash() {
    // 🕒 WASM
    const t0 = performance.now();
    this.wasmResult = await wasmSha256(this.input);
    const t1 = performance.now();
    this.wasmTime = +(t1 - t0).toFixed(2);

    // 🕒 JS
    const t2 = performance.now();
    this.jsResult = crypto.SHA256(this.input).toString();
    const t3 = performance.now();
    this.jsTime = +(t3 - t2).toFixed(2);
  }
}
