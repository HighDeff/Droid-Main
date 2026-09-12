export interface GameState {
  gamePhase: "menu" | "playing" | "game_over" | "exploring";
  entities: Map<string, any>;
  health?: number;
  [key: string]: any;
}

export class GameStateManager {
  private state: GameState = {
    gamePhase: "playing",
    entities: new Map(),
    health: 100,
  };

  getState(): GameState {
    return this.state;
  }

  setState(newState: Partial<GameState>): void {
    this.state = {
      ...this.state,
      ...newState,
    };
  }

  updatePhase(phase: GameState["gamePhase"]): void {
    this.state.gamePhase = phase;
  }
}

export const gameStateManager = new GameStateManager();
