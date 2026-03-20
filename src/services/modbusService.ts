import { SoilData } from '../types';
import { serial as polyfillSerial } from 'web-serial-polyfill';

export class ModbusSimulator {
  private interval: NodeJS.Timeout | null = null;
  private onData: (data: Partial<SoilData>) => void;

  constructor(onData: (data: Partial<SoilData>) => void) {
    this.onData = onData;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const data: Partial<SoilData> = {
        temperature: parseFloat((20 + Math.random() * 10).toFixed(1)),
        humidity: parseFloat((40 + Math.random() * 20).toFixed(1)),
        conductivity: Math.floor(300 + Math.random() * 200),
        ph: parseFloat((5.5 + Math.random() * 1.5).toFixed(1)),
        nitrogen: Math.floor(20 + Math.random() * 10),
        phosphorus: Math.floor(30 + Math.random() * 15),
        potassium: Math.floor(35 + Math.random() * 10),
        fertility: Math.floor(70 + Math.random() * 30),
      };
      this.onData(data);
    }, 2000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export class WebSerialModbus {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;

  private getSerial() {
    // @ts-ignore
    if (navigator.serial) return navigator.serial;
    // @ts-ignore
    if (navigator.usb) return polyfillSerial;
    return null;
  }

  async connect() {
    const serial = this.getSerial();
    if (!serial) {
      console.error('Serial API not supported');
      return false;
    }

    try {
      this.port = await serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable.getWriter();
      this.reader = this.port.readable.getReader();
      return true;
    } catch (err) {
      console.error('Serial connection failed:', err);
      return false;
    }
  }

  async readSensor(): Promise<Partial<SoilData> | null> {
    if (!this.port || !this.writer || !this.reader) return null;

    // Modbus RTU Read Holding Registers (03)
    // Slave ID: 01, Start: 0000, Count: 0007
    const command = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x07]);
    const crc = this.calculateCRC(command);
    const fullCommand = new Uint8Array([...command, crc & 0xFF, (crc >> 8) & 0xFF]);

    try {
      // Clear any stale data before writing
      // (Some polyfills might have buffered data)
      
      await this.writer.write(fullCommand);
      
      // Read loop: Mobile browsers often return data in small chunks
      let received = new Uint8Array(0);
      const startTime = Date.now();
      const timeout = 2000; // 2 seconds timeout

      while (received.length < 19 && (Date.now() - startTime) < timeout) {
        // Race condition: reader might be locked or closed
        try {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const newBuffer = new Uint8Array(received.length + value.length);
            newBuffer.set(received);
            newBuffer.set(value, received.length);
            received = newBuffer;
          }
        } catch (readErr) {
          console.error('Chunk read error:', readErr);
          break;
        }
      }

      if (received.length < 19) {
        console.warn(`Incomplete Modbus response: ${received.length}/19 bytes`);
        return null;
      }

      const view = new DataView(received.buffer);
      
      // Typical 7-in-1 sensor mapping
      // [ID][FC][Len][D1H][D1L]...[D7H][D7L][CRCL][CRCH]
      // Data starts at index 3
      return {
        humidity: view.getInt16(3) / 10,
        temperature: view.getInt16(5) / 10,
        conductivity: view.getInt16(7),
        ph: view.getInt16(9) / 10,
        nitrogen: view.getInt16(11),
        phosphorus: view.getInt16(13),
        potassium: view.getInt16(15),
        fertility: Math.floor((view.getInt16(11) + view.getInt16(13) + view.getInt16(15)) / 3),
      };
    } catch (err) {
      console.error('Modbus read failed:', err);
      return null;
    }
  }

  private calculateCRC(buffer: Uint8Array): number {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x0001) !== 0) {
          crc >>= 1;
          crc ^= 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  async disconnect() {
    if (this.reader) {
      await this.reader.cancel();
      this.reader.releaseLock();
    }
    if (this.writer) {
      this.writer.releaseLock();
    }
    if (this.port) {
      await this.port.close();
    }
  }
}
