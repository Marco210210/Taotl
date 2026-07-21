// Distribuzione carte per la modalità "classica", per numero di giocatori (2-12).
// Ogni sequenza ha sempre 6 turni e termina sempre con 3, 2, 1.
export const CLASSICA_TABLE: Record<number, number[]> = {
  2: [25, 15, 10, 3, 2, 1],
  3: [22, 18, 8, 3, 2, 1],
  4: [18, 12, 7, 3, 2, 1],
  5: [14, 11, 7, 3, 2, 1],
  6: [12, 9, 6, 3, 2, 1],
  7: [11, 8, 5, 3, 2, 1],
  8: [9, 7, 5, 3, 2, 1],
  9: [8, 6, 4, 3, 2, 1],
  10: [7, 5, 4, 3, 2, 1],
  11: [6, 5, 4, 3, 2, 1],
  12: [6, 5, 4, 3, 2, 1],
};
