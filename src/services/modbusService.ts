import { SoilData } from '../types';

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

// Placeholder for real WebUSB Modbus implementation
export class WebUSBModbus {
  // This would use navigator.usb to connect to the OTG sensor
  // and implement the Modbus RTU protocol over serial.
  // For now, we'll stick with the simulator.
}
