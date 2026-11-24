/* Keeps one combined view of the auction (config, live lot, players, teams)
   and tells the page when it changes or when a player has just been sold. */

import { mergeConfig } from "./engine.js";

export function watchAll(store, { onState, onResult } = {}) {
  const state = {
    cfg: mergeConfig(null),
    live: null,
    players: [],
    teams: { team1: null, team2: null },
    loaded: { cfg: false, live: false, players: false, team1: false, team2: false },
  };
  const emit = () => onState && onState(state);

  const unsubs = [
    store.watchDoc("config/auction", (d) => { state.cfg = mergeConfig(d); state.loaded.cfg = true; emit(); }),
    store.watchDoc("auction/live", (d) => {
      const prev = state.live;
      state.live = d;
      state.loaded.live = true;
      if (prev && prev.status !== "idle" && prev.playerId && d && d.status === "idle" && onResult) {
        // the player document updates in its own snapshot; give it a moment to land
        setTimeout(() => {
          const p = state.players.find((x) => x.id === prev.playerId);
          if (!p) return;
          if (p.status === "sold") onResult({ outcome: "sold", player: p, team: p.team, price: p.soldPrice });
          else if (p.status === "unsold") onResult({ outcome: "unsold", player: p });
        }, 350);
      }
      emit();
    }),
    store.watchCollection("players", (list) => {
      state.players = list.sort((a, b) => (a.approvedAt || 0) - (b.approvedAt || 0));
      state.loaded.players = true;
      emit();
    }),
    store.watchDoc("teams/team1", (d) => { state.teams.team1 = d; state.loaded.team1 = true; emit(); }),
    store.watchDoc("teams/team2", (d) => { state.teams.team2 = d; state.loaded.team2 = true; emit(); }),
  ];
  return { state, stop: () => unsubs.forEach((u) => u && u()) };
}

export const playerById = (state, id) => state.players.find((p) => p.id === id) || null;
