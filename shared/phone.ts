export interface PhoneFrame {
  image: string;
  width: number;
  height: number;
  timestamp?: number;
  hash?: string;
}

export interface PhoneRecording {
  id: string;
  startTime: number;
  endTime?: number;
  startedAt?: number;
  frames: PhoneFrame[];
  actions: PhoneAction[];
  status?: string;
  state?: string;
  segments?: any[];
  storage?: any;
  error?: any;
}

export interface PhoneAction {
  type: string;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  text?: string;
  key?: string;
  duration?: number;
}
